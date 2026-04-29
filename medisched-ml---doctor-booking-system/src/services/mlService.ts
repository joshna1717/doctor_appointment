import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface Doctor {
  id: number;
  name: string;
  specialization: string;
  hospital: string;
  location: string;
  experience: number;
  fees: number;
  rating: number;
  bio: string;
}

export interface PatientHistory {
  age: number;
  previousVisits: number;
  cancelledBefore: number;
  distanceKm: number;
  bookingDay: number; // 0-6
  bookingHour: number; // 0-23
}

export class MLService {
  /**
   * ML Feature 1: Doctor Recommendation System
   * Uses Gemini to match symptoms with doctor specializations.
   */
  static async recommendDoctors(symptoms: string, doctors: Doctor[]): Promise<Doctor[]> {
    if (!process.env.GEMINI_API_KEY) {
      // Fallback if no API key
      return doctors.slice(0, 3);
    }

    try {
      const doctorContext = doctors.map(d => `${d.id}: ${d.specialization} (${d.bio})`).join('\n');
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Given the symptoms: "${symptoms}", and the following list of doctors with their specializations and bios:\n${doctorContext}\n\nReturn a JSON array of doctor IDs that are most relevant to these symptoms, ordered by relevance. Just the IDs.`,
        config: {
          responseMimeType: "application/json",
        }
      });

      const recommendedIds: number[] = JSON.parse(response.text || "[]");
      return recommendedIds
        .map(id => doctors.find(d => d.id === id))
        .filter((d): d is Doctor => !!d);
    } catch (error) {
      console.error("Recommendation error:", error);
      return doctors.slice(0, 3);
    }
  }

  /**
   * ML Feature 2: Appointment No-Show Prediction
   * Simple Logistic Regression-like scoring.
   */
  static predictNoShow(history: PatientHistory): number {
    // Weights (simulated from a trained model)
    const wAge = -0.02; // Older patients are more likely to show up
    const wPrevVisits = -0.1; // More previous visits = more likely to show up
    const wCancelled = 0.5; // Previous cancellations = more likely to no-show
    const wDistance = 0.05; // Further distance = more likely to no-show
    const wPeakHour = 0.2; // Peak hours (e.g., 8am or 5pm) = slightly more no-show
    const bias = -1.0;

    const isPeak = (history.bookingHour >= 8 && history.bookingHour <= 10) || (history.bookingHour >= 16 && history.bookingHour <= 18);
    
    const z = bias + 
              (wAge * history.age) + 
              (wPrevVisits * history.previousVisits) + 
              (wCancelled * history.cancelledBefore) + 
              (wDistance * history.distanceKm) + 
              (wPeakHour * (isPeak ? 1 : 0));

    // Sigmoid function
    const probability = 1 / (1 + Math.exp(-z));
    return parseFloat(probability.toFixed(2));
  }

  /**
   * ML Feature 3: Waiting Time Prediction
   * Simple Linear Regression-like prediction.
   */
  static predictWaitingTime(currentBookings: number, avgDuration: number): number {
    // Base waiting time + (number of people ahead * avg duration)
    const baseWait = 5; // minutes
    const loadFactor = 1.2; // overhead per patient
    
    const predicted = baseWait + (currentBookings * avgDuration * loadFactor);
    return Math.round(predicted);
  }
}
