
export enum EmotionStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export interface AudioFile {
  id: string;
  file: File;
  name: string;
  size: string;
  status: EmotionStatus;
  emotionType?: string;
  emotionLevel?: number;
  voiceIdentity?: string;
  reasoning?: string;
  error?: string;
}

export interface AnalysisResult {
  emotionType: string;
  emotionLevel: number;
  voiceIdentity: string;
  reasoning: string;
}
