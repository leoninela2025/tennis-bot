export interface BookingRequest {
  facility: 'Indoor' | 'Outdoor';
  court?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm local facility time
  durationMinutes: number;
}

export async function bookCourt(request: BookingRequest) {
  // TODO: implement Playwright-driven booking flow
  console.log('booking court placeholder', request);
}
