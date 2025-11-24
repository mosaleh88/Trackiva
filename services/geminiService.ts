
import { GoogleGenAI } from "@google/genai";

// Note: In a real app, you would not expose the key on the client, 
// or you would force the user to input it. 
// For this demo, we assume the API key is available as an environment variable.

let ai: GoogleGenAI | null = null;

try {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (apiKey) {
        ai = new GoogleGenAI({ apiKey });
    }
} catch (error) {
    console.error("Failed to initialize GoogleGenAI", error);
}

export type InsightContext = 'dashboard' | 'global_report' | 'student_profile';

export const generateSchoolInsights = async (
  data: any,
  context: InsightContext,
  role: string,
  language: 'en' | 'ar'
): Promise<string> => {
  if (!ai) return "API Key not configured.";

  let promptContext = "";

  if (context === 'student_profile') {
      promptContext = `
        CONTEXT: You are analyzing a SINGLE STUDENT'S 360° Report.
        FOCUS: Look for patterns in their attendance (specific days absent), clinic visits (recurring symptoms), and e-pass usage (frequent destinations or unauthorized exits).
        GOAL: Identify if this student is "At Risk" (academically, medically, or behaviorally) and suggest specific interventions for the ${role}.
      `;
  } else if (context === 'global_report') {
      promptContext = `
        CONTEXT: You are analyzing the SCHOOL-WIDE Aggregate Reports.
        FOCUS: Look for trends across Grades/Sections (e.g., Grade 10 has low attendance), health outbreaks (spikes in Fever/Flu in Clinic data), or operational issues (high unauthorized exits).
        GOAL: Provide a strategic summary for the ${role} to improve school operations or student wellbeing.
      `;
  } else {
      promptContext = `
        CONTEXT: General Dashboard Summary.
        FOCUS: Real-time status (Attendance %, Active Issues).
      `;
  }

  const prompt = `
    You are an AI Assistant for Trackiva (School Management System).
    ${promptContext}

    DATA JSON:
    ${JSON.stringify(data, (key, value) => {
        // Replacer to truncate long lists to save tokens, keep summaries
        if (key === 'list' && Array.isArray(value) && value.length > 20) return value.slice(0, 20);
        if (key === 'history' && Array.isArray(value) && value.length > 20) return value.slice(0, 20);
        return value;
    })}

    OUTPUT FORMAT:
    - Concise 2-3 sentences summarizing the key insight.
    - 1 Bullet point with a direct "Actionable Recommendation".
    - Output Language: ${language === 'ar' ? 'Arabic' : 'English'}.
    - Tone: Professional, educational, and concise.
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
