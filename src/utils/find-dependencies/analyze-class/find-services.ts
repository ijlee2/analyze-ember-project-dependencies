import { AST } from '@codemod-utils/ast-javascript';

import type { PackageAnalysis } from '../../../types/index.js';
import type { Data } from '../index.js';

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
    visitClassProperty(node) {
      if (
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        !Array.isArray(node.value.decorators) ||
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        node.value.decorators.length !== 1
      ) {
        return false;
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const decorator = node.value.decorators[0];
      let serviceName: string | undefined;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      switch (decorator.expression.type) {
        case 'CallExpression': {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (decorator.expression.callee.name == 'service') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            serviceName = decorator.expression.arguments[0].value as string;
          }

          break;
        }

        case 'Identifier': {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (decorator.expression.name === 'service') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            serviceName = dasherize(node.value.key.name as string);
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
