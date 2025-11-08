import { Artifact, ArtifactType } from '../types/artifact.types';

export function detectArtifacts(response: string): Artifact[] {
  const artifacts: Artifact[] = [];

  // Detect Claude.ai-style artifacts: <antArtifact identifier="id" type="type" title="title">content</antArtifact>
  const antArtifactRegex = /<antArtifact\s+identifier="([^"]+)"\s+type="([^"]+)"(?:\s+language="([^"]+)")?\s+title="([^"]+)">([\s\S]*?)<\/antArtifact>/g;
  let match;

  while ((match = antArtifactRegex.exec(response)) !== null) {
    const [, identifier, type, language, title, content] = match;

    // Map Claude.ai artifact types to our types
    let artifactType: ArtifactType;
    let processedContent: string | object = content.trim();

    switch (type) {
      case 'application/vnd.ant.code':
        artifactType = language === 'html' || language === 'javascript' ? 'html' : 'react';
        break;
      case 'application/vnd.ant.spreadsheet':
        artifactType = 'excel';
        try {
          processedContent = JSON.parse(content.trim());
        } catch (e) {
          console.error('Failed to parse spreadsheet JSON:', e);
        }
        break;
      case 'application/vnd.ant.chart':
        artifactType = 'chart';
        try {
          processedContent = JSON.parse(content.trim());
        } catch (e) {
          console.error('Failed to parse chart JSON:', e);
        }
        break;
      case 'text/markdown':
        artifactType = 'markdown';
        break;
      default:
        artifactType = 'html';
    }

    artifacts.push({
      id: identifier,
      type: artifactType,
      title,
      content: processedContent,
      code: typeof processedContent === 'string' ? processedContent : JSON.stringify(processedContent, null, 2),
      createdAt: new Date(),
    });
  }

  // Fallback: detect old-style markers for backward compatibility
  if (artifacts.length === 0) {
    const fallbackRegex = /```artifact:(\w+):(\w+)\n([\s\S]*?)```/g;
    while ((match = fallbackRegex.exec(response)) !== null) {
      const [, type, title, content] = match;

      artifacts.push({
        id: Date.now().toString() + Math.random(),
        type: type as ArtifactType,
        title,
        content: ['chart', 'excel'].includes(type) ? JSON.parse(content) : content,
        code: content,
        createdAt: new Date(),
      });
    }
  }

  // Last resort: detect large code blocks
  if (artifacts.length === 0) {
    const codeBlockRegex = /```(\w+)\n([\s\S]{200,}?)```/g;
    while ((match = codeBlockRegex.exec(response)) !== null) {
      const [, lang, code] = match;

      if (['html', 'javascript', 'jsx', 'tsx'].includes(lang)) {
        artifacts.push({
          id: Date.now().toString() + Math.random(),
          type: 'html',
          title: `${lang} Code`,
          content: code,
          code,
          createdAt: new Date(),
        });
      }
    }
  }

  return artifacts;
}
