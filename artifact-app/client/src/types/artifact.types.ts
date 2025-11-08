export type ArtifactType =
  | 'html'
  | 'react'
  | 'chart'
  | 'excel'
  | 'document'
  | 'powerpoint'
  | 'markdown';

export interface Artifact {
  id: string;
  type: ArtifactType;
  title: string;
  content: string | object;
  code?: string;
  createdAt: Date;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  artifacts?: Artifact[];
  timestamp: Date;
}
