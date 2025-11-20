import { GoogleGenAI } from "@google/genai";

// Note: In a real app, you would not expose the key on the client, 
// or you would force the user to input it. 
// For this demo, we assume process.env.API_KEY is available as per instructions.

let ai: GoogleGenAI | null = null;

try {
    if (process.env.API_KEY) {
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
} catch (error) {
    console.error("Failed to initialize GoogleGenAI", error);
}

export const generateSchoolInsights = async (
  dataSummary: any,
  role: string,
  language: 'en' | 'ar'
): Promise<string> => {
  if (!ai) return "API Key not configured.";

  const prompt = `
    You are an AI Assistant for a School Management System called Trackiva.
    Analyze the following JSON data representing the school's current status:
    ${JSON.stringify(dataSummary)}

    The user asking is a: ${role}.
    Please provide a concise, 2-sentence summary of the current situation and 1 actionable recommendation relevant to their role.
    
    Output Language: ${language === 'ar' ? 'Arabic' : 'English'}.
    Tone: Professional and Helpful.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "No insights available at the moment.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return language === 'ar' 
      ? "عذراً، حدث خطأ أثناء تحليل البيانات."
      : "Sorry, there was an error analyzing the data.";
  }
};