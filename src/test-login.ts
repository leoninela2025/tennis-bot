import 'dotenv/config';
import { CourtBookingAutomation } from './automation/booking';

async function testLogin() {
  const email = process.env.USTA_EMAIL;
  const password = process.env.USTA_PASSWORD;

  if (!email || !password) {
    console.error('Missing USTA_EMAIL or USTA_PASSWORD environment variables');
    console.log('\nPlease create a .env file with:');
    console.log('USTA_EMAIL=your-email@example.com');
    console.log('USTA_PASSWORD=your-password');
    return;
  }

  const automation = new CourtBookingAutomation({ email, password });

  try {
    console.log('Initializing browser...');
    await automation.initialize();

    console.log('Testing login...');
    const success = await automation.login();

    if (success) {
      console.log('✅ Login test passed!');
    } else {
      console.log('❌ Login test failed');
    }
  } catch (error) {
    console.error('Test error:', error);
  } finally {
    console.log('Closing browser...');
    await automation.close();
  }
}

testLogin().catch(console.error);
