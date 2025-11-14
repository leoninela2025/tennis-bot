import 'dotenv/config';
import { CourtBookingAutomation } from './automation/booking';

async function testBooking() {
  const email = process.env.USTA_EMAIL;
  const password = process.env.USTA_PASSWORD;

  if (!email || !password) {
    console.error('Missing USTA_EMAIL or USTA_PASSWORD environment variables');
    return;
  }

  const automation = new CourtBookingAutomation({ email, password });

  try {
    console.log('Initializing browser...');
    await automation.initialize();

    console.log('Testing court booking...');
    
    // Book for two days after current date
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 2);
    
    // You can test with different scenarios:
    const targetTime = '8:30 AM'; // This might be disabled and open a popup
    // const targetTime = '7:00 AM'; // This might be available directly
    const duration = '2 hours'; // Book for 2 hours
    
    console.log(`Attempting to book for: ${targetDate.toDateString()} at ${targetTime} for ${duration}`);
    const success = await automation.bookCourt(targetDate, targetTime, duration);

    if (success) {
      console.log('✅ Booking test completed successfully!');
    } else {
      console.log('❌ Booking test failed');
    }
  } catch (error) {
    console.error('Test error:', error);
  } finally {
    console.log('\nClosing browser...');
    await automation.close();
  }
}

testBooking().catch(console.error);
