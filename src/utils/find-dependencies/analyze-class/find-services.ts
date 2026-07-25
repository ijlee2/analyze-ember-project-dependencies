import { AST } from '@codemod-utils/ast-javascript';

import type { PackageAnalysis } from '../../../types/index.js';
import type { Data } from '../index.js';

type Decorator = ReturnType<typeof AST.builders.decorator>;

function dasherize(value: string): string {
  return value.replace(/([a-z\d])([A-Z])/g, '$1-$2').toLowerCase();
}

export function findServices(file: string, data: Data): PackageAnalysis {
  const { entities } = data;

  const dependencies = new Set<string>();
  const unknowns = new Set<string>();

  AST.traverse(file, {
    visitClassProperty(path) {
      // @ts-expect-error: Incorrect type
      const decorators = path.node.decorators as Decorator[] | undefined;

      if (decorators === undefined || decorators.length !== 1) {
        return false;
      }

      const decorator = decorators[0]!;
      let serviceName: string | undefined;

      switch (decorator.expression.type) {
        case 'CallExpression': {
          if (
            decorator.expression.callee.type === 'Identifier' &&
            decorator.expression.callee.name === 'service' &&
            path.node.key.type === 'Identifier'
          ) {
            const param = decorator.expression.arguments[0];

            if (param === undefined) {
              serviceName = dasherize(path.node.key.name);
            } else if (param.type === 'StringLiteral') {
              serviceName = param.value;
            }
          }

          break;
        }

        case 'Identifier': {
          if (
            decorator.expression.name === 'service' &&
            path.node.key.type === 'Identifier'
          ) {
            serviceName = dasherize(path.node.key.name);
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
