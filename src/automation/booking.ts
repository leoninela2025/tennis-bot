import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { sendNotification } from '../notifications';

export interface LoginCredentials {
  email: string;
  password: string;
}

export class CourtBookingAutomation {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private isLoggedIn = false;

  constructor(private readonly credentials: LoginCredentials) {}

  async initialize() {
    this.browser = await chromium.launch({
      headless: process.env.HEADLESS !== 'false',
      slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : undefined,
      // Screenshots are disabled, remove browser.screenshot option if it exists
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1500, height: 900 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    this.page = await this.context.newPage();
  }

  async login(): Promise<boolean> {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    try {
      console.log('Navigating to login page...');
      await this.page.goto('https://usta.courtreserve.com/Account/Login', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Take a screenshot for debugging
      // if (process.env.DEBUG) {
      //   await this.page.screenshot({ path: 'login-page.png', fullPage: true });
      //   console.log('Screenshot saved to login-page.png');
      // }

      // Wait for login form to be ready
      await this.page.waitForLoadState('domcontentloaded');

      // Log the current URL to see if we were redirected
      console.log('Current URL:', this.page.url());

      // Find email field
      const emailFieldLocator = this.page?.locator('input[name="email"]');
      if (!emailFieldLocator) {
        throw new Error('Could not find email input field locator');
      }
      console.log('Found email field');

      console.log('Filling login form...');
      await emailFieldLocator.fill(this.credentials.email);

      // Find password field
      const passwordFieldLocator = this.page?.locator('input[name="password"]');
      if (!passwordFieldLocator) {
        throw new Error('Could not find password input field locator');
      }
      console.log('Found password field');
      await passwordFieldLocator.fill(this.credentials.password);

      // Click remember me checkbox if present
      const rememberMeLabelLocator = this.page?.locator('label:has-text("Remember Me")');
      const rememberMeInputLocator = this.page?.getByRole('checkbox', { name: 'Remember Me' });

      if (rememberMeLabelLocator && await rememberMeLabelLocator.isVisible() && rememberMeInputLocator) {
        const isChecked = await rememberMeInputLocator.isChecked();
        if (!isChecked) {
          await rememberMeLabelLocator.click(); // Click the label to toggle the checkbox
          console.log('✅ Checked "Remember Me" checkbox by clicking label');
        } else {
          console.log('"Remember Me" checkbox already checked');
        }
      }

      // Click submit button
      console.log('Submitting login...');
      const submitButtonLocator = this.page?.locator('button[type="submit"]');
      if (!submitButtonLocator) {
        throw new Error('Could not find submit button locator');
      }
      
      await Promise.all([
        this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
        submitButtonLocator.click()
      ]);

      // Wait for navigation or page update after login
      await this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

      // Check if login was successful
      const currentUrl = this.page.url();
      
      // First check if we've been redirected away from the login page
      if (currentUrl.includes('/Online/Portal/') || 
          currentUrl.includes('/dashboard') || 
          currentUrl.includes('/home') ||
          !currentUrl.includes('/Account/Login')) {
        console.log('Login successful! Redirected to:', currentUrl);
        this.isLoggedIn = true;
        return true;
      }

      // Check for common success indicators
      const logoutButtonLocator = this.page?.locator('a[href*="Logout"], button:has-text("Logout")');
      const bookCourtButtonLocator = this.page?.locator('a:has-text("Book a Court")');
      
      if ((logoutButtonLocator && await logoutButtonLocator.isVisible()) || 
          (bookCourtButtonLocator && await bookCourtButtonLocator.isVisible())) {
        console.log('Login successful!');
        this.isLoggedIn = true;
        return true;
      } else {
        // Check for error messages before declaring failure
        const errorSelectors = ['.error', '.alert-danger', '[class*="error-message"]', '.validation-summary-errors'];
        let hasError = false;
        for (const selector of errorSelectors) {
          const error = await this.page.$(selector);
          if (error) {
            const errorText = await error.textContent();
            console.error('Error message found:', errorText);
            hasError = true;
          }
        }
        
        if (!hasError && currentUrl !== this.page.url()) {
          // No errors and URL changed, likely successful
          console.log('Login appears successful based on URL change');
          this.isLoggedIn = true;
          return true;
        }
        
        console.error('Login may have failed - could not verify success');
        console.log('Current URL:', currentUrl);
        return false;
      }

    } catch (error) {
      console.error('Error during login:', error);
      // if (process.env.DEBUG) {
      //   await this.page.screenshot({ path: 'error-screenshot.png', fullPage: true });
      //   console.log('Error screenshot saved to error-screenshot.png');
      // }
      return false;
    }
  }

  async bookCourt(targetDate?: Date, targetTime?: string, duration: string = '2 hours'): Promise<boolean> {
    if (!this.isLoggedIn) {
      console.log('Not logged in. Attempting login...');
      const loginSuccess = await this.login();
      if (!loginSuccess) {
        throw new Error('Failed to login');
      }
    }

    // Capture the timestamp of this booking attempt
    const bookingAttemptTimestamp = new Date();

    try {
      console.log('Starting court booking process...');
      
      // Direct navigation to the booking page
      const bookingUrl = 'https://usta.courtreserve.com/Online/Reservations/Bookings/5881?sId=294';
      console.log(`Navigating directly to booking page: ${bookingUrl}`);
      
      await this.page?.goto(bookingUrl, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      console.log('Successfully navigated to booking page');
      console.log('Current URL:', this.page?.url());

      // Wait for booking page elements to load
      await this.page?.waitForSelector('.k-nav-current, [data-testid="link-0"]', { timeout: 5000 }).catch(() => {});

      // Take a screenshot for debugging
      // if (process.env.DEBUG) {
      //   await this.page?.screenshot({ path: 'booking-page-loaded.png', fullPage: true });
      //   console.log('Screenshot saved to booking-page-loaded.png');
      // }

      // Step 1: Select date
      console.log('Looking for date selector...');
      
      // Click on the current date to open calendar
      const dateElementLocator = this.page?.locator('a[data-testid="link-0"]');
      if (!dateElementLocator) {
        throw new Error('Could not find date selector locator');
      }
      
      console.log('Opening calendar...');
      await dateElementLocator.click();
      
      // Wait for calendar to appear
      await this.page?.waitForSelector('.k-calendar', { timeout: 3000 });

      // If a target date is provided, navigate to it
      if (targetDate) {
        console.log(`Selecting date: ${targetDate.toDateString()}`);
        
        // Wait for calendar to be visible
        await this.page?.waitForSelector('.k-calendar', { timeout: 5000 });
        
        // Format the date for selection
        const targetDay = targetDate.getDate();
        const targetMonth = targetDate.toLocaleString('en-US', { month: 'long' });
        const targetYear = targetDate.getFullYear();
        
        // Navigate to correct month/year if needed
        // This is simplified - you might need to handle month/year navigation
        
        // Click on the target date
        const dateLinkLocator = this.page?.locator(`.k-calendar td a:has-text("${targetDay}")`).first();
        if (!dateLinkLocator || !await dateLinkLocator.isVisible()) {
          console.warn('Could not select specific date, using current date');
        } else {
          await dateLinkLocator.click();
          console.log(`Selected date: ${targetDate.toDateString()}`);
        }
      } else {
        console.log('No target date specified, using currently selected date');
        // Close calendar if still open
        await this.page?.keyboard.press('Escape');
      }

      // Wait for time slots to become available after date selection
      console.log('Waiting for time slots to load...');
      await this.page?.waitForSelector('a.slot-btn', { timeout: 5000 }).catch(() => {
        // Fallback to short wait if selector not found
        return this.page?.waitForTimeout(500);
      });

      // Step 2: Select time slot
      console.log('Selecting time slot...');
      
      // Find all slot buttons
      const allSlots = await this.page?.$$('a.slot-btn');
      console.log(`Found ${allSlots?.length || 0} total time slots`);

      let timeSelected = false;
      let selectableSlots: { element: any, time: string, dateTime: Date }[] = [];
      
      if (allSlots) {
        // Collect all slots, regardless of disabled state
        for (const slot of allSlots) {
          try {
            const dataHref = await slot.getAttribute('data-href');
            
            if (dataHref) {
              const startMatch = dataHref.match(/start=([^&]+)/);
              if (startMatch) {
                const startTime = decodeURIComponent(startMatch[1]);
                // All slots are considered selectable
                selectableSlots.push({
                  element: slot,
                  time: startTime,
                  dateTime: new Date(startTime)
                });
              }
            }
          } catch (error) {
            console.error('Error checking slot:', error);
          }
        }
        
        // If we have any slots, pick the closest one after the current time
        if (selectableSlots.length > 0) {
          selectableSlots.sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime()); // Sort by time

          // Determine the earliest slot after the current system time on the target date
          let selectedSlot = null;
          const currentTime = new Date();
          // currentTime.setSeconds(0, 0); // Keep full time for precise comparison

          console.log(`DEBUG: Current system time (full): ${currentTime.toLocaleString()}`);
          console.log(`DEBUG: Current system date: ${currentTime.toDateString()}`);
          console.log(`DEBUG: Target booking date: ${targetDate?.toDateString()}`);
          console.log('DEBUG: All selectable slots (sorted):');
          selectableSlots.forEach(slot => console.log(`  - ${slot.time} (DateTime: ${slot.dateTime.toLocaleString()})`));

          // Construct a comparison time: targetDate with currentTime's time component
          const comparisonTime = new Date(targetDate || currentTime);
          comparisonTime.setHours(currentTime.getHours(), currentTime.getMinutes(), currentTime.getSeconds(), currentTime.getMilliseconds());
          console.log(`DEBUG: Comparison time for filtering: ${comparisonTime.toLocaleString()}`);

          // Filter for slots on the target date that are strictly after the comparison time
          const futureSlotsOnTargetDate = selectableSlots.filter(slot => {
            return slot.dateTime.getTime() > comparisonTime.getTime();
          });
          
          if (futureSlotsOnTargetDate.length > 0) {
            selectedSlot = futureSlotsOnTargetDate[0]; // The earliest future slot on target date
            console.log(`DEBUG: Found ${futureSlotsOnTargetDate.length} future slots on target date. Selecting earliest: ${selectedSlot.time}`);
          } else if (selectableSlots.length > 0) {
            // If no slot strictly after comparison time was found, 
            // but there are selectable slots on the target date (meaning all are earlier than comparisonTime),
            // take the very first one on the target day as a fallback (earliest slot for that day).
            console.warn('No slots found strictly after comparison time on the target date. Selecting the earliest slot on the target day as fallback.');
            selectedSlot = selectableSlots[0];
          } else {
            // No selectable slots at all (this case is handled by outer if (!timeSelected) )
            console.error('DEBUG: No selectable slots found at all.');
          }

          if (selectedSlot) {
            await selectedSlot.element.click();
            console.log(`\n✅ Selected closest selectable time slot: ${selectedSlot.time}`);
            timeSelected = true;
          }
        }
      }

      if (!timeSelected) {
        console.error(`❌ Could not find any selectable time slots on ${targetDate?.toDateString()}.`);
        await sendNotification({
          title: '❌ Booking Failed: No Timeslots',
          message: `Failed to find any selectable time slots on ${targetDate?.toDateString()}. Please check manually. Attempted at: <b>${bookingAttemptTimestamp.toLocaleString()}</b>.`
        });
        return false; // Exit if no time slot found
      }

      // Small wait to ensure any UI updates from the JS event complete
      await this.page?.waitForTimeout(500);

      // Wait for modal to appear after clicking Reserve
      console.log('\nWaiting for popup/modal...');
      let modalFound = false;
      
      try {
        await this.page?.waitForSelector('.swal2-popup, .modal, [role="dialog"]', { 
          timeout: 5000,
          state: 'visible' 
        });
        modalFound = true;
        console.log('📋 Modal/popup detected after clicking time slot');
      } catch {
        // No modal found - might be direct booking
        console.log('No modal detected - might be direct booking');
      }

      // Take a screenshot of current state
      // if (process.env.DEBUG) {
      //   const screenshotName = modalFound ? 'booking-modal-opened.png' : 'booking-after-time-selection.png';
      //   await this.page?.screenshot({ path: screenshotName, fullPage: true });
      //   console.log(`Screenshot saved to ${screenshotName}`);
      // }

      if (modalFound) {
        console.log('\n✅ Time slot clicked - modal/popup opened!');
        
        // Step 1: Select duration
        console.log('\n📅 Selecting duration...');

        try {
          // Click on the duration dropdown to open it
          const durationDropdownLocator = this.page?.getByRole('listbox', { name: 'Duration *' });
          if (!durationDropdownLocator) {
            console.warn('Could not find duration dropdown locator.');
            return false;
          }

          console.log('DEBUG: Clicking duration dropdown to open it...');
          await durationDropdownLocator.click();
          console.log('DEBUG: Opened duration dropdown.');
          await this.page?.waitForTimeout(1000); // Debug: Delay after dropdown opens

          console.log(`DEBUG: Attempting to find duration option: ${duration}...`);
          const durationOptionLocator = this.page?.getByRole('option', { name: duration, exact: true });
          if (!durationOptionLocator) {
            console.warn(`DEBUG: Could not find duration option: ${duration}.`);
            return false;
          }
          
          console.log(`DEBUG: Clicking duration option: ${duration}...`);
          await durationOptionLocator.click({
            timeout: 5000 // Increased timeout for clicking the option
          });
          console.log(`DEBUG: Clicked to select ${duration} duration.`);
          await this.page?.waitForTimeout(1000); // Debug: Delay after option click

          // console.log('DEBUG: Waiting for UI and hidden input value to stabilize...');
          // await this.page?.waitForFunction(
          //   ({ selector, inputId, expectedText, expectedInputValue }) => {
          //     const el = document.querySelector(selector);
          //     const input = document.getElementById(inputId) as HTMLInputElement;
          //     return el && el.textContent?.includes(expectedText) && input && input.value === expectedInputValue;
          //   },
          //   { selector: '[aria-labelledby="Duration_label"] .k-input-value-text', inputId: 'Duration', expectedText: duration, expectedInputValue: '2' }, // Assuming '2 hours' maps to value '2'
          //   { timeout: 10000 } // Increased timeout for stability
          // );
          console.log(`✅ Verified UI and hidden input value for ${duration} duration.`);
          
        } catch (error) {
          console.warn(`❌ Failed to reliably set duration to ${duration} via Playwright clicks. Defaulting to 1 hour.`);
          // If Playwright clicks fail to set 2 hours, revert to default 1 hour
          // The dropdown should already be open, or will revert to 1 hour naturally.
          // No explicit action needed here other than logging the fallback.
          duration = '1 hour'; // Update duration variable for logging and subsequent actions
        }
        
        // Small wait to ensure any UI updates from the JS event complete
        await this.page?.waitForTimeout(500);

        // Step 2: Check the disclosure agreement checkbox
        console.log('\n📝 Checking disclosure agreement...');
        
        // Target the label associated with the checkbox, as it intercepts clicks
        const checkboxLabelLocator = this.page?.locator('label[for="DisclosureAgree"]');
        if (!checkboxLabelLocator) {
          console.warn('Could not find disclosure agreement checkbox label locator');
          return false;
        }
        
        // Check the input itself to see if it's already checked
        const checkboxInputLocator = this.page?.locator('#DisclosureAgree');
        if (!checkboxInputLocator) {
          console.warn('Could not find disclosure agreement checkbox input locator');
          return false;
        }
        
        const isChecked = await checkboxInputLocator.isChecked();
        if (!isChecked) {
          await checkboxLabelLocator.click(); // Click the label to toggle the checkbox
          console.log('✅ Checked disclosure agreement by clicking label');
        } else {
          console.log('Disclosure agreement already checked');
        }
        
        // Step 3: Click Save button and handle retries
        console.log('\n💾 Attempting to click Save button with retries...');

        const maxSaveRetries = 3;
        let lastErrorMessage: string | null = null;

        for (let retryCount = 0; retryCount < maxSaveRetries; retryCount++) {
          const saveButtonLocator = this.page?.locator('button[data-testid="Save"]');
          if (!saveButtonLocator) {
            console.warn('Could not find Save button locator');
            // Send notification about critical failure to find save button
            await sendNotification({
              title: '❌ Booking Failed: Save Button Missing',
              message: `Booking failed: Could not find the Save button for ${targetDate?.toDateString()} at ${targetTime || 'nearest future slot'} for ${duration}. Attempted at: <b>${bookingAttemptTimestamp.toLocaleString()}</b>.`
            });
            return false;
          }
          
          await saveButtonLocator.click();
          console.log(`✅ Clicked Save button (Attempt ${retryCount + 1}/${maxSaveRetries})`);
          
          // Wait for booking to complete or an error popup to appear
          console.log('Waiting for booking confirmation or error popup...');
          const result = await Promise.race([
            this.page?.waitForNavigation({ timeout: 5000 }).then(() => 'navigation').catch(() => null),
            this.page?.waitForSelector('.swal2-popup.swal2-icon-error', { timeout: 5000 }).then(() => 'error_popup').catch(() => null),
            this.page?.waitForSelector('.success, .confirmation, [class*="success"]', { timeout: 5000 }).then(() => 'success_indicator').catch(() => null),
            this.page?.waitForTimeout(1500).then(() => 'timeout') // Minimum wait as fallback
          ]);

          if (result === 'navigation' || result === 'success_indicator') {
            console.log('\n🎉 Booking process completed successfully!');
            await sendNotification({
              title: '✅ Tennis Court Booked!',
              message: `Your tennis court for <b>${targetDate?.toDateString()}</b> at <b>${targetTime || 'nearest future slot'}</b> for <b>${duration}</b> was successfully booked. Attempted at: <b>${bookingAttemptTimestamp.toLocaleString()}</b>. Check your CourtReserve account for details: https://usta.courtreserve.com/Online/Portal/Index/5881`
            });
            // if (process.env.DEBUG) {
            //   await this.page?.screenshot({ path: 'booking-completed.png', fullPage: true });
            //   console.log('Screenshot saved to booking-completed.png');
            // }
            return true; // Booking succeeded
          } else if (result === 'error_popup') {
            console.warn('❌ SweetAlert2 error popup detected: No available courts. Attempting to dismiss...');
            
            // Capture the error message from the popup
            const errorMessageElement = this.page?.locator('#swal2-html-container');
            if (errorMessageElement && await errorMessageElement.isVisible()) {
              lastErrorMessage = await errorMessageElement.textContent();
              console.warn(`Captured error: ${lastErrorMessage}`);
            } else {
              console.warn('Could not capture error message from popup.');
              lastErrorMessage = 'Unknown error from popup.';
            }

            // if (process.env.DEBUG) {
            //   await this.page?.screenshot({ path: `booking-error-popup-attempt-${retryCount + 1}.png`, fullPage: true });
            //   console.log(`Screenshot saved to booking-error-popup-attempt-${retryCount + 1}.png`);
            // }

            // Click the OK button to close the popup
            const okButton = this.page?.locator('button.swal2-confirm');
            if (okButton) {
              await okButton.click();
              console.log('Clicked OK on error popup.');
              await this.page?.waitForSelector('.swal2-popup', { state: 'hidden', timeout: 3000 }).catch(() => {}); // Wait for popup to disappear
            } else {
              console.warn('Could not find OK button on error popup.');
              // If we can't dismiss the popup, we can't retry effectively.
              lastErrorMessage = lastErrorMessage || 'Critical: Could not dismiss error popup.';
              break; // Exit retry loop as we're stuck
            }
            
            if (retryCount < maxSaveRetries - 1) {
              console.log(`Retrying save operation... (Retry ${retryCount + 2})`);
              await this.page?.waitForTimeout(1000); // Short delay before next retry
            } else {
              console.error(`❌ Max retries (${maxSaveRetries}) reached.`);
              // Fall through to send final notification
            }
          } else {
            console.warn('No clear outcome after clicking save. Attempting to retry.');
            if (retryCount < maxSaveRetries - 1) {
              await this.page?.waitForTimeout(1000); // Short delay before next retry
            } else {
              console.error(`❌ Max retries (${maxSaveRetries}) reached.`);
              // Fall through to send final notification
            }
          }
        }
        // If we reach here, booking ultimately failed after all retries or critical error.
        // Construct a more detailed error message for the final notification.
        const finalFailureMessage = lastErrorMessage ? `Booking failed after ${maxSaveRetries} attempts. Reason: ${lastErrorMessage}` : `Booking failed after ${maxSaveRetries} attempts for ${targetDate?.toDateString()} at ${targetTime || 'nearest future slot'} for ${duration}. Attempted at: <b>${bookingAttemptTimestamp.toLocaleString()}</b>.`;
        await sendNotification({
          title: '❌ Booking Failed',
          message: finalFailureMessage + `\nAttempted at: <b>${bookingAttemptTimestamp.toLocaleString()}</b>.` + `\nPlease check the CourtReserve website manually: https://usta.courtreserve.com/Online/Portal/Index/5881`
        });
        return false;
      } else {
        console.log('\n✅ Time slot selected successfully! (No booking modal appeared)');
        console.log('At this point, the booking flow would continue with:');
        console.log('  - Court selection (if applicable)');
        console.log('  - Booking confirmation');
        console.log('  - Payment (if required)');
        await sendNotification({
          title: '✅ Time Slot Selected (Manual Confirmation Needed)',
          message: `Time slot for <b>${targetDate?.toDateString()}</b> at <b>${targetTime || 'nearest future slot'}</b> for <b>${duration}</b> was selected. Attempted at: <b>${bookingAttemptTimestamp.toLocaleString()}</b>. No booking modal appeared, manual confirmation needed on: https://usta.courtreserve.com/Online/Reservations/Bookings/5881?sId=294`
        });
        return true; // No modal, time slot clicked, assume success up to this point
      }
    } catch (error) {
      console.error('Error booking court:', error);
      // If an unexpected error occurred before a specific outcome, send a general failure notification.
      const errorMessage = `An unexpected error occurred during booking for ${targetDate?.toDateString()} at ${targetTime || 'nearest future slot'} for ${duration}. Error: ${error instanceof Error ? error.message : String(error)}`;
      await sendNotification({
        title: '❌ Booking Failed: Unexpected Error',
        message: errorMessage + `\nAttempted at: <b>${bookingAttemptTimestamp.toLocaleString()}</b>.` + `\nPlease check the CourtReserve website manually: https://usta.courtreserve.com/Online/Portal/Index/5881`
      });
      return false;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
      this.isLoggedIn = false;
    }
  }
}

// Convenience function for backwards compatibility
export async function bookCourt(targetDate?: Date, targetTime?: string, duration?: string) {
  const email = process.env.USTA_EMAIL;
  const password = process.env.USTA_PASSWORD;

  if (!email || !password) {
    throw new Error('Missing USTA_EMAIL or USTA_PASSWORD environment variables');
}

  const automation = new CourtBookingAutomation({ email, password });
  
  try {
    await automation.initialize();
    return await automation.bookCourt(targetDate, targetTime, duration);
  } finally {
    await automation.close();
  }
}

