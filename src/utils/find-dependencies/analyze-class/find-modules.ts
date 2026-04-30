import { AST } from '@codemod-utils/ast-javascript';

import type { PackageAnalysis } from '../../../types/index.js';
import type { Data } from '../index.js';

const MODULE_PREFIXES_TO_IGNORE: string[] = [
  '.',
  '..',
  '@ember/',
  '@glimmer/',
  'node:',
];

function getDependency(moduleName: string): string {
  const tokens = moduleName.split('/');

  if (moduleName.startsWith('@')) {
    return `${tokens[0]}/${tokens[1]}`;
  }

  return `${tokens[0]}`;
}

function ignore(moduleName: string): boolean {
  if (moduleName.startsWith('dummy')) {
    return true;
  }

  if (
    MODULE_PREFIXES_TO_IGNORE.some((prefix) => moduleName.startsWith(prefix))
  ) {
    return true;
  }

  return false;
}

export function findModules(file: string, data: Data): PackageAnalysis {
  const { filePath } = data;

  const dependencies = new Set<string>();
  const unknowns = new Set<string>();

  const isTypeScript = filePath.endsWith('.ts');
  const traverse = AST.traverse(isTypeScript);

  traverse(file, {
    visitCallExpression(path) {
      let moduleName: string | undefined;

      switch (path.node.callee.type) {
        case 'Identifier': {
          if (path.node.callee.name === 'require') {
            // @ts-expect-error: Incorrect type
            moduleName = path.node.arguments[0]!.value as string;
          }

          break;
        }

        case 'MemberExpression': {
          if (
            // @ts-expect-error: Incorrect type
            path.node.callee.object.name === 'require' &&
            // @ts-expect-error: Incorrect type
            path.node.callee.property.name === 'resolve'
          ) {
            // @ts-expect-error: Incorrect type
            moduleName = path.node.arguments[0]!.value as string;
          }

          break;
        }
      }

      if (moduleName === undefined) {
        return false;
      }

      if (ignore(moduleName)) {
        return false;
      }

      dependencies.add(getDependency(moduleName));

      return false;
    },

    visitExportAllDeclaration(path) {
      const moduleName = path.node.source.value as string;

      if (ignore(moduleName)) {
        return false;
      }

      dependencies.add(getDependency(moduleName));

      return false;
    },

    visitExportNamedDeclaration(path) {
      if (!path.node.source) {
        return false;
      }

      const moduleName = path.node.source.value as string;

      if (ignore(moduleName)) {
        return false;
      }

      dependencies.add(getDependency(moduleName));

      return false;
    },

    visitImportDeclaration(path) {
      const moduleName = path.node.source.value as string;

      if (ignore(moduleName)) {
        return false;
      }

      dependencies.add(getDependency(moduleName));

      return false;
    },
  });

  return {
    dependencies,
    unknowns,
  };
}
