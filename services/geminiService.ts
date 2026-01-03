
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types";

// Analyze audio emotion using Gemini 3 Pro model for high-quality reasoning
export const analyzeAudioEmotion = async (base64Data: string, mimeType: string): Promise<AnalysisResult> => {
  // Always create a new instance right before making an API call to ensure it uses the most up-to-date API key
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Data,
          },
        },
        {
          text: `
          你是一位专业的情感音频分析专家。你的任务是分析这段音频中的情感以及说话者的音色角色属性。
          
          **关键规则**：
          1. **严禁仅根据文字内容判断**：即使说话者说的是开心的事，如果语调是悲伤的，你也必须判定为悲伤。
          2. **声学特征优先**：分析语调、语流速度、音量波动、共鸣感、呼吸状态、声音颤抖程度等。
          3. **角色识别**：准确判断说话者的音色属性，包括性别、大概年龄段及音质特征。
          
          **输出要求**：
          请以 JSON 格式返回以下信息：
          - emotionType: 情绪类型（如：愤怒、快乐、悲伤、恐惧、惊讶、疑惑、平静、厌恶、焦急等）。
          - emotionLevel: 情绪强度等级（1-10的整数，1代表极其轻微且几乎难以察觉，10代表极其强烈且完全失去控制）。
          - voiceIdentity: 音色角色属性（如：中年男性、清脆的小女孩、沙哑的老年女性、充满活力的青年男声等）。
          - reasoning: 简短的判断依据（描述你听到了什么样的声音特征）。
          `
        }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          emotionType: { type: Type.STRING },
          emotionLevel: { type: Type.INTEGER },
          voiceIdentity: { type: Type.STRING },
          reasoning: { type: Type.STRING },
        },
        required: ["emotionType", "emotionLevel", "voiceIdentity", "reasoning"],
      }
    }
  });

  const text = response.text.trim();
  return JSON.parse(text) as AnalysisResult;
};
