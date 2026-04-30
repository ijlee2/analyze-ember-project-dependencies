import { AST } from '@codemod-utils/ast-javascript';

import type { PackageAnalysis } from '../../../types/index.js';
import type { Data } from '../index.js';

type Decorator = ReturnType<typeof AST.builders.decorator>;

function dasherize(value: string): string {
  return value.replace(/([a-z\d])([A-Z])/g, '$1-$2').toLowerCase();
}

export function findServices(file: string, data: Data): PackageAnalysis {
  const { entities, filePath } = data;

  const dependencies = new Set<string>();
  const unknowns = new Set<string>();

  const isTypeScript = filePath.endsWith('.ts');
  const traverse = AST.traverse(isTypeScript);

  traverse(file, {
    visitClassProperty(path) {
      // @ts-expect-error: Incorrect type
      const decorators = path.node.decorators as Decorator[];

      if (!Array.isArray(decorators) || decorators.length !== 1) {
        return false;
      }

      const decorator = decorators[0]!;
      let serviceName: string | undefined;

      switch (decorator.expression.type) {
        case 'CallExpression': {
          if (
            decorator.expression.callee.type === 'Identifier' &&
            decorator.expression.callee.name === 'service'
          ) {
            // @ts-expect-error: Incorrect type
            serviceName = decorator.expression.arguments[0]!.value as string;
          }

          break;
        }

        case 'Identifier': {
          if (decorator.expression.name === 'service') {
            // @ts-expect-error: Incorrect type
            serviceName = dasherize(path.node.key.name as string);
          }

          break;
        }
      }

      if (!serviceName) {
        return false;
      }

      const dependency = entities.services.get(serviceName);

      if (dependency) {
        dependencies.add(dependency);
      } else {
        unknowns.add(`Service - ${serviceName} (${data.filePath})`);
      }

      return false;
    },
  });

  return {
    dependencies,
    unknowns,
  };
}
