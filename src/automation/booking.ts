import { chromium, Browser, Page, BrowserContext } from 'playwright';

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
      if (process.env.DEBUG) {
        await this.page.screenshot({ path: 'login-page.png', fullPage: true });
        console.log('Screenshot saved to login-page.png');
      }

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
      const rememberMe = await this.page.$('input[name="RememberMe"], input[type="checkbox"][id*="remember" i]');
      if (rememberMe) {
        await rememberMe.check();
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
      if (process.env.DEBUG) {
        await this.page.screenshot({ path: 'error-screenshot.png', fullPage: true });
        console.log('Error screenshot saved to error-screenshot.png');
      }
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
      if (process.env.DEBUG) {
        await this.page?.screenshot({ path: 'booking-page-loaded.png', fullPage: true });
        console.log('Screenshot saved to booking-page-loaded.png');
      }

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
      
      if (targetTime) {
        // Find all slot buttons (including disabled ones to check target)
        const allSlots = await this.page?.$$('a.slot-btn');
        console.log(`Found ${allSlots?.length || 0} total time slots`);

        let timeSelected = false;
        let targetSlotDisabled = false;
        let availableSlots: { element: any, time: string, dateTime: Date }[] = [];
        
        if (allSlots) {
          // First pass: check all slots and build available list
          for (const slot of allSlots) {
            try {
              const dataHref = await slot.getAttribute('data-href');
              
              if (dataHref) {
                const startMatch = dataHref.match(/start=([^&]+)/);
                if (startMatch) {
                  const startTime = decodeURIComponent(startMatch[1]);
                  const classList = await slot.getAttribute('class') || '';
                  const isDisabled = classList.includes('disabled') || classList.includes('fn-disable');
                  
                  // Check if this is our target time
                  if (startTime.includes(targetTime)) {
                    console.log(`Found target time slot: ${startTime}`);
                    
                    // Click it regardless of disabled state
                    await slot.click();
                    if (isDisabled) {
                      console.log(`✅ Clicked Reserve button for ${targetTime} (slot is marked as disabled - popup expected)`);
                    } else {
                      console.log(`✅ Clicked Reserve button for ${targetTime} (available slot)`);
                    }
                    timeSelected = true;
                    break;
                  }
                  
                  // Add to available slots list if not disabled
                  if (!isDisabled) {
                    availableSlots.push({
                      element: slot,
                      time: startTime,
                      dateTime: new Date(startTime)
                    });
                  }
                }
              }
            } catch (error) {
              console.error('Error checking slot:', error);
            }
          }
          
          // If target wasn't selected and we have available slots, pick the next best one
          if (!timeSelected && availableSlots.length > 0) {
            console.log(`\n${targetSlotDisabled ? 'Target slot disabled. ' : 'Target slot not found. '}Selecting next available slot...`);
            
            // Sort available slots by time
            availableSlots.sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());
            
            // Log all available slots
            console.log(`\n📋 Found ${availableSlots.length} available time slots:`);
            availableSlots.forEach((slot, index) => {
              console.log(`  ${index + 1}. ${slot.time}`);
            });
            
            // Try to find next slot after target time
            let selectedSlot = null;
            const targetDateTime = new Date(`${availableSlots[0].time.split(' ')[0]} ${targetTime}`);
            
            for (const slot of availableSlots) {
              if (slot.dateTime > targetDateTime) {
                selectedSlot = slot;
                break;
              }
            }
            
            // If no slot after target time, pick the first available
            if (!selectedSlot && availableSlots.length > 0) {
              selectedSlot = availableSlots[0];
            }
            
            if (selectedSlot) {
              await selectedSlot.element.click();
              console.log(`\n✅ Selected alternative time slot: ${selectedSlot.time}`);
              console.log(`   (Original target ${targetTime} was ${targetSlotDisabled ? 'disabled/booked' : 'not found'})`);
              timeSelected = true;
            }
          }
        }

        if (!timeSelected) {
          console.error(`❌ Could not find any available time slots`);
        }
      } else {
        // No specific time requested, click first available slot
        const firstAvailable = await this.page?.$('a.slot-btn:not(.disabled):not([disabled]):not(.fn-disable)');
        if (firstAvailable) {
          const dataHref = await firstAvailable.getAttribute('data-href');
          const startMatch = dataHref?.match(/start=([^&]+)/);
          const startTime = startMatch ? decodeURIComponent(startMatch[1]) : 'unknown';
          
          await firstAvailable.click();
          console.log(`Clicked first available slot: ${startTime}`);
        } else {
          console.error('No available time slots found');
        }
      }

      // Wait for modal to appear after clicking Reserve
      console.log('\nWaiting for popup/modal...');
      let modalFound = false;
      
      try {
        await this.page?.waitForSelector('.modal, [role="dialog"]', { 
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
      if (process.env.DEBUG) {
        const screenshotName = modalFound ? 'booking-modal-opened.png' : 'booking-after-time-selection.png';
        await this.page?.screenshot({ path: screenshotName, fullPage: true });
        console.log(`Screenshot saved to ${screenshotName}`);
      }

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

          console.log('DEBUG: Waiting for UI and hidden input value to stabilize...');
          await this.page?.waitForFunction(
            ({ selector, inputId, expectedText, expectedInputValue }) => {
              const el = document.querySelector(selector);
              const input = document.getElementById(inputId) as HTMLInputElement;
              return el && el.textContent?.includes(expectedText) && input && input.value === expectedInputValue;
            },
            { selector: '[aria-labelledby="Duration_label"] .k-input-value-text', inputId: 'Duration', expectedText: duration, expectedInputValue: '2' }, // Assuming '2 hours' maps to value '2'
            { timeout: 500 } // Increased timeout for stability
          );
          console.log(`✅ Verified UI and hidden input value for ${duration} duration.`);
          
        } catch (error) {
          console.warn(`❌ Failed to set duration to ${duration} via Playwright clicks. Attempting aggressive JavaScript fallback.`);
          // Fallback to direct JavaScript evaluation if Playwright clicks fail
          const durationValue = '2'; // Assuming '2 hours' corresponds to value '2'
          const durationText = '2 hours';
          await this.page?.evaluate(({ value, id }) => {
            const input = document.getElementById(id) as HTMLInputElement;
            if (input) {
              input.value = value;
              input.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }, { value: durationValue, id: 'Duration' });
          console.log(`✅ Selected ${durationText} duration via aggressive JavaScript fallback`);
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
        for (let retryCount = 0; retryCount < maxSaveRetries; retryCount++) {
          const saveButtonLocator = this.page?.locator('button[data-testid="Save"]');
          if (!saveButtonLocator) {
            console.warn('Could not find Save button locator');
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
            // Take final screenshot
            if (process.env.DEBUG) {
              await this.page?.screenshot({ path: 'booking-completed.png', fullPage: true });
              console.log('Screenshot saved to booking-completed.png');
            }
            return true; // Booking succeeded
          } else if (result === 'error_popup') {
            console.warn('❌ SweetAlert2 error popup detected: No available courts. Attempting to dismiss...');
            // Take a screenshot of the error
            if (process.env.DEBUG) {
              await this.page?.screenshot({ path: `booking-error-popup-attempt-${retryCount + 1}.png`, fullPage: true });
              console.log(`Screenshot saved to booking-error-popup-attempt-${retryCount + 1}.png`);
            }

            // Click the OK button to close the popup
            const okButton = this.page?.locator('button.swal2-confirm');
            if (okButton) {
              await okButton.click();
              console.log('Clicked OK on error popup.');
              await this.page?.waitForSelector('.swal2-popup', { state: 'hidden', timeout: 3000 }).catch(() => {}); // Wait for popup to disappear
            } else {
              console.warn('Could not find OK button on error popup.');
              return false; // Cannot dismiss, something is wrong
            }
            
            if (retryCount < maxSaveRetries - 1) {
              console.log(`Retrying save operation... (Retry ${retryCount + 2})`);
              await this.page?.waitForTimeout(1000); // Short delay before next retry
            } else {
              console.error(`❌ Max retries (${maxSaveRetries}) reached. Booking failed.`);
              return false; // Max retries reached, booking failed
            }
          } else {
            console.warn('No clear outcome after clicking save. Attempting to retry.');
            if (retryCount < maxSaveRetries - 1) {
              await this.page?.waitForTimeout(1000); // Short delay before next retry
            } else {
              console.error(`❌ Max retries (${maxSaveRetries}) reached. Booking failed.`);
              return false; // Max retries reached, booking failed
            }
          }
        }

        // Should not reach here if logic above is complete, but for type safety:
        return false;
      } else {
        console.log('\n✅ Time slot selected successfully!');
        console.log('At this point, the booking flow would continue with:');
        console.log('  - Court selection (if applicable)');
        console.log('  - Booking confirmation');
        console.log('  - Payment (if required)');
      }
      
      return true;
    } catch (error) {
      console.error('Error booking court:', error);
      if (process.env.DEBUG) {
        await this.page?.screenshot({ path: 'booking-error.png', fullPage: true });
        console.log('Error screenshot saved to booking-error.png');
      }
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

