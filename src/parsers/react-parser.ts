import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import * as t from '@babel/types';
import { readFileSync } from 'fs';

const traverse =
  typeof _traverse === 'function' ? _traverse : _traverse.default;

export interface ExtractedString {
  text: string;
  line: number;
  column: number;
  context: string;
  type: 'jsx_text' | 'jsx_attribute' | 'string_literal' | 'template_literal';
  key?: string;
}

export class ReactParser {
  private extractedStrings: ExtractedString[] = [];

  public parseFile(filePath: string): ExtractedString[] {
    this.extractedStrings = [];

    try {
      const code = readFileSync(filePath, 'utf-8');
      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript', 'decorators-legacy'],
      });

      traverse(ast, {
        // Texte dans les éléments JSX: <h1>Bonjour</h1>
        JSXText: path => {
          const text = path.node.value.trim();
          if (this.shouldExtract(text)) {
            this.extractedStrings.push({
              text,
              line: path.node.loc?.start.line || 0,
              column: path.node.loc?.start.column || 0,
              context: this.getJSXContext(path),
              type: 'jsx_text',
            });
          }
        },

        // Attributs JSX: <Button label="Confirmer" />
        JSXExpressionContainer: path => {
          if (t.isStringLiteral(path.node.expression)) {
            const text = path.node.expression.value;
            if (this.shouldExtract(text)) {
              this.extractedStrings.push({
                text,
                line: path.node.loc?.start.line || 0,
                column: path.node.loc?.start.column || 0,
                context: this.getJSXAttributeContext(path),
                type: 'jsx_attribute',
              });
            }
          }
        },

        // Strings littérales: const message = "Bonjour"
        StringLiteral: path => {
          // Éviter les doublons avec JSX
          if (this.isInJSX(path)) return;

          const text = path.node.value;
          if (this.shouldExtract(text)) {
            this.extractedStrings.push({
              text,
              line: path.node.loc?.start.line || 0,
              column: path.node.loc?.start.column || 0,
              context: this.getVariableContext(path),
              type: 'string_literal',
            });
          }
        },

        // Template literals: `Bonjour ${name}`
        TemplateLiteral: path => {
          if (this.isInJSX(path)) return;

          const text = this.reconstructTemplateLiteral(path.node);
          if (this.shouldExtract(text)) {
            this.extractedStrings.push({
              text,
              line: path.node.loc?.start.line || 0,
              column: path.node.loc?.start.column || 0,
              context: this.getVariableContext(path),
              type: 'template_literal',
            });
          }
        },
      });

      return this.extractedStrings;
    } catch (error) {
      console.error(`Erreur lors du parsing de ${filePath}:`, error);
      return [];
    }
  }

  private shouldExtract(text: string): boolean {
    // Filtres de base
    if (!text || text.length < 2) return false;
    if (/^[\s\n\r]*$/.test(text)) return false; // Seulement espaces
    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(text)) return false; // Noms de variables
    if (/^[./\\]+$/.test(text)) return false; // Chemins relatifs
    if (/^\d+(\.\d+)?$/.test(text)) return false; // Nombres purs
    if (/^#[0-9a-fA-F]{3,8}$/.test(text)) return false; // Couleurs hex
    if (text.includes('className') || text.includes('onClick')) return false; // Props React

    return true;
  }

  private isInJSX(path: any): boolean {
    let parent = path.parent;
    while (parent) {
      if (t.isJSXElement(parent) || t.isJSXFragment(parent)) {
        return true;
      }
      parent = path.parentPath?.parent;
      path = path.parentPath;
    }
    return false;
  }

  private getJSXContext(path: any): string {
    const parent = path.findParent((p: any) => t.isJSXElement(p.node));
    if (parent && t.isJSXElement(parent.node)) {
      const tagName = t.isJSXIdentifier(parent.node.openingElement.name)
        ? parent.node.openingElement.name.name
        : 'JSXElement';
      return `<${tagName}>`;
    }
    return 'JSX';
  }

  private getJSXAttributeContext(path: any): string {
    const jsxAttribute = path.findParent((p: any) => t.isJSXAttribute(p.node));
    if (jsxAttribute && t.isJSXAttribute(jsxAttribute.node)) {
      const attrName = t.isJSXIdentifier(jsxAttribute.node.name)
        ? jsxAttribute.node.name.name
        : 'attribute';
      return `JSX attribute: ${attrName}`;
    }
    return 'JSX attribute';
  }

  private getVariableContext(path: any): string {
    const variableDeclarator = path.findParent((p: any) =>
      t.isVariableDeclarator(p.node)
    );
    if (variableDeclarator && t.isVariableDeclarator(variableDeclarator.node)) {
      const id = variableDeclarator.node.id;
      if (t.isIdentifier(id)) {
        return `Variable: ${id.name}`;
      }
    }

    const property = path.findParent((p: any) => t.isObjectProperty(p.node));
    if (property && t.isObjectProperty(property.node)) {
      const key = property.node.key;
      if (t.isIdentifier(key)) {
        return `Object property: ${key.name}`;
      }
    }

    return 'String literal';
  }

  private reconstructTemplateLiteral(node: t.TemplateLiteral): string {
    let result = '';
    for (let i = 0; i < node.quasis.length; i++) {
      result += node.quasis[i].value.cooked || node.quasis[i].value.raw;
      if (i < node.expressions.length) {
        result += `{${this.getExpressionPlaceholder(node.expressions[i])}}`;
      }
    }
    return result;
  }

  private getExpressionPlaceholder(expr: t.Expression | t.TSType): string {
    if (t.isIdentifier(expr)) {
      return expr.name;
    }
    if (t.isMemberExpression(expr)) {
      return 'value';
    }
    if (t.isTSType(expr)) {
      return 'type';
    }
    return 'expression';
  }
}
