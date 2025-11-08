/**
 * Strip code blocks and artifact tags from message content for display in chat
 * Code should only appear in the artifact panel, not in the chat area
 */
export function stripCodeBlocksAndArtifacts(content: string): string {
  let cleaned = content;

  // Remove complete <antArtifact> tags and their content
  cleaned = cleaned.replace(/<antArtifact\s+[^>]*>[\s\S]*?<\/antArtifact>/g, '');

  // Remove incomplete artifact tags (during streaming)
  // Match from <antArtifact to the end if no closing tag yet
  if (cleaned.includes('<antArtifact') && !cleaned.includes('</antArtifact>')) {
    cleaned = cleaned.replace(/<antArtifact[\s\S]*$/g, '');
  }

  // Remove code blocks (```...```)
  cleaned = cleaned.replace(/```[\s\S]*?```/g, '[Code in artifact panel]');

  // Clean up multiple newlines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // Trim whitespace
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Check if a message contains artifacts
 */
export function hasArtifacts(content: string): boolean {
  return /<antArtifact/.test(content) || /```/.test(content);
}
