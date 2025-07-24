import { glob } from 'glob';
import { ReactParser, ExtractedString } from './parsers/react-parser';
import { relative } from 'path';
import fs from 'fs';

export interface ScanResult {
  file: string;
  strings: ExtractedString[];
}

export interface ScanOptions {
  patterns?: string[];
  exclude?: string[];
  extensions?: string[];
}

export class FileScanner {
  private reactParser = new ReactParser();

  public async scan(rootDir: string = '.', options: ScanOptions = {}): Promise<ScanResult[]> {
    const {
      patterns = ['**/*.{js,jsx,ts,tsx}'],
      exclude = ['node_modules/**', 'dist/**', 'build/**', '.git/**'],
      extensions = ['.js', '.jsx', '.ts', '.tsx'],
    } = options;

    const results: ScanResult[] = [];

    try {
      // Trouve tous les fichiers correspondants
      const files = await glob(patterns, {
        cwd: rootDir,
        ignore: exclude,
        absolute: true,
      });

      console.log(`📁 Scanning ${files.length} files...`);

      for (const file of files) {
        const relativePath = relative(rootDir, file);

        try {
          const strings = this.parseFile(file);

          if (strings.length > 0) {
            results.push({
              file: relativePath,
              strings,
            });
            console.log(`✅ ${relativePath}: ${strings.length} strings found`);
          } else {
            console.log(`⚪ ${relativePath}: no translatable strings`);
          }
        } catch (error) {
          console.error(`❌ Error parsing ${relativePath}:`, error);
        }
      }

      return results;
    } catch (error) {
      console.error('❌ Error during scan:', error);
      return [];
    }
  }

  private parseFile(filePath: string): ExtractedString[] {
    // Pour l'instant, on ne supporte que React/JSX
    // Plus tard, on ajoutera des parseurs pour Vue, Angular, etc.
    return this.reactParser.parseFile(filePath);
  }

  public generateSummary(results: ScanResult[]): void {
    const totalFiles = results.length;
    const totalStrings = results.reduce((sum, result) => sum + result.strings.length, 0);

    console.log('\n📊 SCAN SUMMARY');
    console.log('===============');
    console.log(`Files scanned: ${totalFiles}`);
    console.log(`Translatable strings found: ${totalStrings}`);

    if (totalStrings > 0) {
      console.log('\n📝 Breakdown by type:');
      const typeCount = new Map<string, number>();

      results.forEach((result) => {
        result.strings.forEach((str) => {
          typeCount.set(str.type, (typeCount.get(str.type) || 0) + 1);
        });
      });

      typeCount.forEach((count, type) => {
        console.log(`  ${type}: ${count}`);
      });
    }
  }

  public exportToJSON(results: ScanResult[], outputPath: string = 'translatable-strings.json'): void {
    const exportData = {
      generatedAt: new Date().toISOString(),
      totalFiles: results.length,
      totalStrings: results.reduce((sum, result) => sum + result.strings.length, 0),
      files: results.map((result) => ({
        file: result.file,
        stringCount: result.strings.length,
        strings: result.strings.map((str) => ({
          text: str.text,
          line: str.line,
          column: str.column,
          context: str.context,
          type: str.type,
          key: this.generateKey(str),
        })),
      })),
    };

    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
    console.log(`\n💾 Results exported to ${outputPath}`);
  }

  private generateKey(str: ExtractedString): string {
    // Génère une clé basée sur le texte (à améliorer plus tard)
    return str.text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Retire les accents
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .substring(0, 50);
  }
}
