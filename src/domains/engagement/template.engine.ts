import { Injectable } from '@nestjs/common';

@Injectable()
export class TemplateEngine {
  /**
   * Parses a raw template string returning a formatted value.
   * e.g., "Hello {{patient_name}}, your scan is on {{date}}." -> "Hello John, your scan is on Monday."
   */
  parseTemplate(template: string, variables: Record<string, string>): string {
    if (!template) return '';
    return template.replace(/\{\{(.*?)\}\}/g, (match, key) => {
      const trimmedKey = key.trim();
      return variables[trimmedKey] !== undefined ? variables[trimmedKey] : match;
    });
  }
}
