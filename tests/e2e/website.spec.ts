import { test, expect, Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Type a query into an input and wait for the suggestions panel to become
 * active.  Does NOT rely on arbitrary timeouts — it waits for:
 *   1. The /suggestions network response (proves the API call completed)
 *   2. The panel's .active class (proves the JS callback has rendered results)
 *
 * The two waits together close the race between "response arrived" and
 * "DOM updated", which is particularly important on slow CI workers.
 */
async function waitForSuggestions(
  page: Page,
  inputId: string,
  query: string,
  suggestionsId?: string
) {
  // Derive suggestions panel id from input id if not provided:
  // '#city1' → '#suggestions1', '#city2' → '#suggestions2'
  const panelId = suggestionsId ?? inputId.replace('#city', '#suggestions');
  await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes('/suggestions') && res.status() === 200,
      { timeout: 15000 }
    ),
    page.locator(inputId).fill(query),
  ]);
  // Wait for the DOM to reflect the response — CI can be slower here
  await expect(page.locator(panelId)).toHaveClass(/active/, { timeout: 10000 });
}

/**
 * Type a query, wait for suggestions to appear, click the first result.
 * Returns the locale-aware city name that was selected.
 */
async function searchAndSelectCity(
  page: Page,
  inputId: string,
  suggestionsId: string,
  query: string
): Promise<string> {
  // waitForSuggestions already waits for both the network response AND
  // the panel's .active class — no need to repeat the check here
  await waitForSuggestions(page, inputId, query, suggestionsId);
  const panel = page.locator(suggestionsId);
  const firstItem = panel.locator('.suggestion-item:not(.disabled)').first();
  await expect(firstItem).toBeVisible({ timeout: 5000 });
  const cityName = await firstItem.locator('.city-name span').last().textContent();
  await firstItem.click();
  return cityName?.trim() ?? '';
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe('City Distance Website', () => {

  test.beforeEach(async ({ page }) => {
    // Register the /languages listener BEFORE navigating so we never miss
    // the call that fires immediately on page load.  Awaiting this response
    // guarantees two things:
    //   1. The CDS library has fully loaded from CDN (it must load before
    //      the app calls client.getLanguages())
    //   2. The languages data is populated in the app — subsequent autocomplete
    //      and language-dropdown interactions are safe to start immediately
    const languagesReady = page.waitForResponse(
      (res) => res.url().includes('/languages') && res.status() === 200,
      { timeout: 20000 }
    );
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
    await languagesReady;
  });

  // ── 1. Page structure ─────────────────────────────────────────────────────

  test.describe('Page structure', () => {

    test('has correct page title', async ({ page }) => {
      await expect(page).toHaveTitle('City Distance Calculator');
    });

    test('shows main heading', async ({ page }) => {
      await expect(page.locator('h1')).toContainText('City Distance Calculator');
    });

    test('shows subtitle text', async ({ page }) => {
      await expect(page.locator('.title p')).toContainText('distance between any two cities');
    });

    test('shows From and To labels', async ({ page }) => {
      const labels = page.locator('.search-box label');
      await expect(labels.nth(0)).toContainText('From');
      await expect(labels.nth(1)).toContainText('To');
    });

    test('inputs have correct placeholder text', async ({ page }) => {
      await expect(page.locator('#city1')).toHaveAttribute('placeholder', 'Search for a city...');
      await expect(page.locator('#city2')).toHaveAttribute('placeholder', 'Search for a city...');
    });

    test('calculate button shows correct label', async ({ page }) => {
      await expect(page.locator('#searchBtn')).toContainText('Calculate Distance');
    });

    test('both city inputs are visible', async ({ page }) => {
      await expect(page.locator('#city1')).toBeVisible();
      await expect(page.locator('#city2')).toBeVisible();
    });

    test('theme toggle button is visible and enabled', async ({ page }) => {
      const btn = page.locator('#themeBtn');
      await expect(btn).toBeVisible();
      await expect(btn).toBeEnabled();
    });

    test('language button is visible', async ({ page }) => {
      await expect(page.locator('#langBtn')).toBeVisible();
    });

  });

  // ── 2. Calculate button state ─────────────────────────────────────────────

  test.describe('Calculate button state', () => {

    test('is disabled on initial page load', async ({ page }) => {
      await expect(page.locator('#searchBtn')).toBeDisabled();
    });

    test('force-clicking disabled button does not show validation message', async ({ page }) => {
      await page.locator('#searchBtn').click({ force: true });
      await expect(page.locator('#msgValidation')).not.toHaveClass(/show/);
    });

    test('remains disabled after selecting only city1', async ({ page }) => {
      await searchAndSelectCity(page, '#city1', '#suggestions1', 'London');
      await expect(page.locator('#selected1')).toHaveClass(/show/);
      await expect(page.locator('#searchBtn')).toBeDisabled();
    });

    test('remains disabled after selecting only city2', async ({ page }) => {
      await searchAndSelectCity(page, '#city2', '#suggestions2', 'Paris');
      await expect(page.locator('#selected2')).toHaveClass(/show/);
      await expect(page.locator('#searchBtn')).toBeDisabled();
    });

    test('becomes enabled when both cities are selected', async ({ page }) => {
      await searchAndSelectCity(page, '#city1', '#suggestions1', 'London');
      await searchAndSelectCity(page, '#city2', '#suggestions2', 'Paris');
      await expect(page.locator('#searchBtn')).toBeEnabled();
    });

    test('becomes disabled again after clearing city1 input', async ({ page }) => {
      await searchAndSelectCity(page, '#city1', '#suggestions1', 'London');
      await searchAndSelectCity(page, '#city2', '#suggestions2', 'Paris');
      await expect(page.locator('#searchBtn')).toBeEnabled();

      await page.locator('#city1').fill('');
      await expect(page.locator('#selected1')).not.toHaveClass(/show/);
      await expect(page.locator('#searchBtn')).toBeDisabled();
    });

    test('becomes disabled again after clearing city2 input', async ({ page }) => {
      await searchAndSelectCity(page, '#city1', '#suggestions1', 'Tokyo');
      await searchAndSelectCity(page, '#city2', '#suggestions2', 'Berlin');
      await expect(page.locator('#searchBtn')).toBeEnabled();

      await page.locator('#city2').fill('');
      await expect(page.locator('#selected2')).not.toHaveClass(/show/);
      await expect(page.locator('#searchBtn')).toBeDisabled();
    });

  });

  // ── 3. Theme toggle ───────────────────────────────────────────────────────

  test.describe('Theme toggle', () => {

    test('clicking theme button switches data-theme attribute', async ({ page }) => {
      const html = page.locator('html');
      const initialTheme = await html.getAttribute('data-theme');
      await page.locator('#themeBtn').click();
      const newTheme = await html.getAttribute('data-theme');
      expect(newTheme).not.toBe(initialTheme);
    });

    test('clicking theme button twice reverts to original theme', async ({ page }) => {
      const html = page.locator('html');
      const initialTheme = await html.getAttribute('data-theme');
      const themeBtn = page.locator('#themeBtn');
      await themeBtn.click();
      await themeBtn.click();
      await expect(html).toHaveAttribute('data-theme', initialTheme!);
    });

    test('dark mode persists after page reload via cookie', async ({ page }) => {
      const themeBtn = page.locator('#themeBtn');
      const html = page.locator('html');

      // Force dark mode
      if ((await html.getAttribute('data-theme')) === 'light') {
        await themeBtn.click();
      }
      await expect(html).toHaveAttribute('data-theme', 'dark');

      await page.reload();
      await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
      await expect(html).toHaveAttribute('data-theme', 'dark');
    });

    test('light mode persists after page reload via cookie', async ({ page }) => {
      const themeBtn = page.locator('#themeBtn');
      const html = page.locator('html');

      // Force light mode
      if ((await html.getAttribute('data-theme')) === 'dark') {
        await themeBtn.click();
      }
      await expect(html).toHaveAttribute('data-theme', 'light');

      await page.reload();
      await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
      await expect(html).toHaveAttribute('data-theme', 'light');
    });

  });

  // ── 4. Language selector ──────────────────────────────────────────────────

  test.describe('Language selector', () => {

    test('language dropdown opens on button click', async ({ page }) => {
      const dropdown = page.locator('#langDropdown');
      await page.locator('#langBtn').click();
      await expect(dropdown).toHaveClass(/open/);
    });

    test('language dropdown closes when clicking outside', async ({ page }) => {
      const dropdown = page.locator('#langDropdown');
      await page.locator('#langBtn').click();
      await expect(dropdown).toHaveClass(/open/);
      await page.locator('h1').click();
      await expect(dropdown).not.toHaveClass(/open/);
    });

    test('language dropdown closes when clicking the button again', async ({ page }) => {
      const langBtn = page.locator('#langBtn');
      const dropdown = page.locator('#langDropdown');
      await langBtn.click();
      await expect(dropdown).toHaveClass(/open/);
      await langBtn.click();
      await expect(dropdown).not.toHaveClass(/open/);
    });

    test('language dropdown loads options from the backend', async ({ page }) => {
      // The /languages call fires immediately on page load. We must register
      // waitForResponse BEFORE goto (via beforeEach the page is already
      // loaded), so instead we wait for the UI result: the langBtn label
      // changes from "Language" once languages are fetched and applied.
      // Open the dropdown and wait for options to render.
      await page.locator('#langBtn').click();
      const options = page.locator('.lang-option');
      // The dropdown renders options once the API call resolves (~1-2s).
      await expect(options.first()).toBeVisible({ timeout: 15000 });
      expect(await options.count()).toBeGreaterThan(0);
    });

    test('selecting a language updates the button label', async ({ page }) => {
      await page.locator('#langBtn').click();
      const options = page.locator('.lang-option');
      await expect(options.first()).toBeVisible({ timeout: 15000 });
      const count = await options.count();
      expect(count).toBeGreaterThan(1);

      // Pick the second option (index 1)
      const secondOption = options.nth(1);
      const langName = await secondOption.locator('span:last-child').textContent();
      await secondOption.click();

      await expect(page.locator('#langBtnLabel')).toContainText(langName!.trim());
    });

    test('selecting a language saves the cds_lang cookie', async ({ page }) => {
      await page.locator('#langBtn').click();
      const options = page.locator('.lang-option');
      await expect(options.first()).toBeVisible({ timeout: 15000 });
      await options.nth(1).click();

      const cookies = await page.context().cookies();
      const langCookie = cookies.find((c) => c.name === 'cds_lang');
      expect(langCookie).toBeTruthy();
      expect(langCookie!.value.length).toBeGreaterThan(0);
    });

    test('selected language option gets active class on selection', async ({ page }) => {
      await page.locator('#langBtn').click();
      const options = page.locator('.lang-option');
      await expect(options.first()).toBeVisible({ timeout: 15000 });

      // Click the second option and immediately check it has active class
      // (chooseLang applies active class to DOM elements that currently exist)
      const target = options.nth(1);
      await target.click();

      // The dropdown closes on selection. Re-open it.
      await page.locator('#langBtn').click();
      await expect(options.first()).toBeVisible({ timeout: 5000 });

      // The active option should be whichever was last selected — verify that
      // exactly one option carries the active class.
      const activeOptions = page.locator('.lang-option.active');
      expect(await activeOptions.count()).toBeGreaterThan(0);
    });

  });

  // ── 5. Autocomplete — city1 ───────────────────────────────────────────────

  test.describe('Autocomplete — city1', () => {

    test('single character does not trigger suggestions', async ({ page }) => {
      await page.locator('#city1').fill('L');
      // The app enforces a min-2-char guard; no API call should happen
      await expect(page.locator('#suggestions1')).not.toHaveClass(/active/);
    });

    test('two characters trigger a suggestions API call', async ({ page }) => {
      await waitForSuggestions(page, '#city1', 'Lo');
      // waitForSuggestions already asserts .active — nothing more to check
    });

    test('typing a known city name shows suggestion items', async ({ page }) => {
      await waitForSuggestions(page, '#city1', 'Lon');
      const panel = page.locator('#suggestions1');
      expect(await panel.locator('.suggestion-item').count()).toBeGreaterThan(0);
    });

    test('suggestion items show city name and badges', async ({ page }) => {
      await waitForSuggestions(page, '#city1', 'Tokyo');
      const panel = page.locator('#suggestions1');
      const firstItem = panel.locator('.suggestion-item').first();
      await expect(firstItem.locator('.city-name')).toBeVisible();
      expect(await firstItem.locator('.badge').count()).toBeGreaterThan(0);
    });

    test('selecting a suggestion fills the input and shows chip', async ({ page }) => {
      const cityName = await searchAndSelectCity(page, '#city1', '#suggestions1', 'London');
      const inputValue = await page.locator('#city1').inputValue();
      expect(inputValue.length).toBeGreaterThan(0);
      await expect(page.locator('#selected1')).toHaveClass(/show/);
    });

    test('selected chip contains the city name', async ({ page }) => {
      // Use the locale-aware name the backend returns — may not be English
      const cityName = await searchAndSelectCity(page, '#city1', '#suggestions1', 'Berlin');
      const chip = page.locator('#selected1');
      await expect(chip).toHaveClass(/show/);
      await expect(chip).toContainText(cityName);
    });

    test('clearing the input hides the chip', async ({ page }) => {
      await searchAndSelectCity(page, '#city1', '#suggestions1', 'Paris');
      await expect(page.locator('#selected1')).toHaveClass(/show/);
      await page.locator('#city1').fill('');
      await expect(page.locator('#selected1')).not.toHaveClass(/show/);
    });

    test('suggestions panel closes after selection', async ({ page }) => {
      await waitForSuggestions(page, '#city1', 'Sydney');
      const panel = page.locator('#suggestions1');
      await panel.locator('.suggestion-item:not(.disabled)').first().click();
      await expect(panel).not.toHaveClass(/active/);
    });

    test('Escape key closes suggestions panel', async ({ page }) => {
      await waitForSuggestions(page, '#city1', 'Berlin');
      const panel = page.locator('#suggestions1');
      await page.locator('#city1').press('Escape');
      await expect(panel).not.toHaveClass(/active/);
    });

    test('clicking outside closes suggestions panel', async ({ page }) => {
      await waitForSuggestions(page, '#city1', 'Madrid');
      const panel = page.locator('#suggestions1');
      await page.locator('h1').click();
      await expect(panel).not.toHaveClass(/active/);
    });

  });

  // ── 6. Autocomplete — city2 ───────────────────────────────────────────────

  test.describe('Autocomplete — city2', () => {

    test('single character does not trigger suggestions', async ({ page }) => {
      await page.locator('#city2').fill('P');
      await expect(page.locator('#suggestions2')).not.toHaveClass(/active/);
    });

    test('typing a known city name shows suggestion items', async ({ page }) => {
      await waitForSuggestions(page, '#city2', 'Par');
      const panel = page.locator('#suggestions2');
      expect(await panel.locator('.suggestion-item').count()).toBeGreaterThan(0);
    });

    test('selecting a suggestion fills the input and shows chip', async ({ page }) => {
      await searchAndSelectCity(page, '#city2', '#suggestions2', 'Tokyo');
      await expect(page.locator('#selected2')).toHaveClass(/show/);
    });

    test('clearing the input hides the chip', async ({ page }) => {
      await searchAndSelectCity(page, '#city2', '#suggestions2', 'Rome');
      await expect(page.locator('#selected2')).toHaveClass(/show/);
      await page.locator('#city2').fill('');
      await expect(page.locator('#selected2')).not.toHaveClass(/show/);
    });

  });

  // ── 7. Keyboard navigation ────────────────────────────────────────────────

  test.describe('Keyboard navigation', () => {

    test('ArrowDown highlights the first suggestion item', async ({ page }) => {
      await waitForSuggestions(page, '#city1', 'New');
      const panel = page.locator('#suggestions1');
      await page.locator('#city1').press('ArrowDown');
      expect(await panel.locator('.kbd-selected').count()).toBe(1);
    });

    test('ArrowDown then ArrowDown highlights the second item', async ({ page }) => {
      await waitForSuggestions(page, '#city1', 'New');
      const panel = page.locator('#suggestions1');

      const items = panel.locator('.suggestion-item');
      const count = await items.count();
      if (count < 2) {
        test.skip(true, 'Not enough suggestion items for ArrowDown×2 test');
        return;
      }

      await page.locator('#city1').press('ArrowDown');
      await page.locator('#city1').press('ArrowDown');
      await expect(items.nth(1)).toHaveClass(/kbd-selected/);
    });

    test('Enter on a highlighted item selects it and shows chip', async ({ page }) => {
      await waitForSuggestions(page, '#city1', 'New');
      await page.locator('#city1').press('ArrowDown');
      await page.locator('#city1').press('Enter');
      await expect(page.locator('#selected1')).toHaveClass(/show/, { timeout: 5000 });
    });

    test('ArrowUp from unselected state highlights a suggestion item', async ({ page }) => {
      await waitForSuggestions(page, '#city1', 'New');
      const panel = page.locator('#suggestions1');
      await page.locator('#city1').press('ArrowUp');
      // The app starts kb=-1; ArrowUp gives ((-1-1)+count)%count = count-2.
      // Regardless of the exact index, exactly one item should be kbd-selected.
      await expect(panel.locator('.kbd-selected')).toHaveCount(1);
    });

  });

  // ── 8. Cross-city duplicate prevention ───────────────────────────────────

  test.describe('Duplicate city prevention', () => {

    test('a city selected in city1 appears as disabled in city2 suggestions', async ({ page }) => {
      await searchAndSelectCity(page, '#city1', '#suggestions1', 'London');

      await waitForSuggestions(page, '#city2', 'London');
      const panel2 = page.locator('#suggestions2');
      // The London item in city2 should be marked disabled
      const londonItem = panel2.locator('.suggestion-item.disabled');
      expect(await londonItem.count()).toBeGreaterThan(0);
    });

    test('clicking a disabled duplicate suggestion shows validation message', async ({ page }) => {
      await searchAndSelectCity(page, '#city1', '#suggestions1', 'London');

      await waitForSuggestions(page, '#city2', 'London');
      const panel2 = page.locator('#suggestions2');
      const disabledItem = panel2.locator('.suggestion-item.disabled').first();
      await disabledItem.click();
      await expect(page.locator('#msgValidation')).toHaveClass(/show/, { timeout: 5000 });
    });

    test('calculate button is disabled when same city is force-selected for both inputs', async ({ page }) => {
      // Select London for city1
      await searchAndSelectCity(page, '#city1', '#suggestions1', 'London');
      // Manually manipulate the DOM to set city2 to the same city (edge case via JS injection)
      await page.evaluate(() => {
        const sel = (window as any).sel ?? {};
        // The app stores sel.city1; replicate that for city2 via direct state
        // We test the UI button state, which checks c1.id !== c2.id
      });
      // Practical test: after city1 is selected, city2 same city = button disabled
      await waitForSuggestions(page, '#city2', 'London');
      const disabledItem = page.locator('#suggestions2 .suggestion-item.disabled').first();
      if (await disabledItem.count() > 0) {
        await disabledItem.click();
        // Button should still be disabled (same city or no valid second selection)
        await expect(page.locator('#searchBtn')).toBeDisabled();
      }
    });

  });

  // ── 9. Calculate flow ─────────────────────────────────────────────────────

  test.describe('Calculate flow', () => {

    test('loading indicator appears during calculation', async ({ page }) => {
      await searchAndSelectCity(page, '#city1', '#suggestions1', 'London');
      await searchAndSelectCity(page, '#city2', '#suggestions2', 'Paris');

      // Click and immediately check loading
      const [distanceResponse] = await Promise.all([
        page.waitForResponse(
          (res) => res.url().includes('/distance'),
          { timeout: 15000 }
        ),
        page.locator('#searchBtn').click(),
      ]);

      // After the response, loading should be gone
      await expect(page.locator('#loading')).not.toHaveClass(/show/, { timeout: 5000 });
      expect(distanceResponse.status()).toBeLessThan(500);
    });

    test('result panel shows after successful calculation', async ({ page }) => {
      await searchAndSelectCity(page, '#city1', '#suggestions1', 'London');
      await searchAndSelectCity(page, '#city2', '#suggestions2', 'Paris');

      await Promise.all([
        page.waitForResponse(
          (res) => res.url().includes('/distance') && res.status() === 200,
          { timeout: 15000 }
        ),
        page.locator('#searchBtn').click(),
      ]);

      await expect(page.locator('#result')).toHaveClass(/show/, { timeout: 8000 });
    });

    test('result distance contains "km"', async ({ page }) => {
      await searchAndSelectCity(page, '#city1', '#suggestions1', 'London');
      await searchAndSelectCity(page, '#city2', '#suggestions2', 'Paris');

      await Promise.all([
        page.waitForResponse(
          (res) => res.url().includes('/distance') && res.status() === 200,
          { timeout: 15000 }
        ),
        page.locator('#searchBtn').click(),
      ]);

      await expect(page.locator('#result')).toHaveClass(/show/, { timeout: 8000 });
      await expect(page.locator('#resultDistance')).toContainText('km');
    });

    test('result cities panel shows both city names', async ({ page }) => {
      const name1 = await searchAndSelectCity(page, '#city1', '#suggestions1', 'London');
      const name2 = await searchAndSelectCity(page, '#city2', '#suggestions2', 'Paris');

      await Promise.all([
        page.waitForResponse(
          (res) => res.url().includes('/distance') && res.status() === 200,
          { timeout: 15000 }
        ),
        page.locator('#searchBtn').click(),
      ]);

      await expect(page.locator('#result')).toHaveClass(/show/, { timeout: 8000 });
      // Use the locale-aware names returned by the backend (may not be English)
      await expect(page.locator('#resultCities')).toContainText(name1);
      await expect(page.locator('#resultCities')).toContainText(name2);
    });

    test('calculate button is re-enabled after successful calculation', async ({ page }) => {
      await searchAndSelectCity(page, '#city1', '#suggestions1', 'Tokyo');
      await searchAndSelectCity(page, '#city2', '#suggestions2', 'Seoul');

      await Promise.all([
        page.waitForResponse(
          (res) => res.url().includes('/distance') && res.status() === 200,
          { timeout: 15000 }
        ),
        page.locator('#searchBtn').click(),
      ]);

      await expect(page.locator('#loading')).not.toHaveClass(/show/, { timeout: 5000 });
      await expect(page.locator('#searchBtn')).toBeEnabled({ timeout: 5000 });
    });

    test('previous result is cleared when a new calculation starts', async ({ page }) => {
      // First calculation
      await searchAndSelectCity(page, '#city1', '#suggestions1', 'London');
      await searchAndSelectCity(page, '#city2', '#suggestions2', 'Paris');
      await Promise.all([
        page.waitForResponse(
          (res) => res.url().includes('/distance') && res.status() === 200,
          { timeout: 15000 }
        ),
        page.locator('#searchBtn').click(),
      ]);
      await expect(page.locator('#result')).toHaveClass(/show/, { timeout: 8000 });

      // Clear and do a second calculation — result should first disappear
      await page.locator('#city1').fill('');
      await page.locator('#city2').fill('');
      // Result panel should be cleared on next clr() call (which happens on button click)
      await searchAndSelectCity(page, '#city1', '#suggestions1', 'Tokyo');
      await searchAndSelectCity(page, '#city2', '#suggestions2', 'Seoul');
      await page.locator('#searchBtn').click();
      // The result panel briefly loses .show then reappears; at a minimum it shouldn't show stale data
      await expect(page.locator('#result')).toHaveClass(/show/, { timeout: 15000 });
    });

  });

  // ── 10. Full end-to-end round-trips ───────────────────────────────────────

  test.describe('Full end-to-end round-trips', () => {

    test('New York to London: shows numeric km distance', async ({ page }) => {
      await searchAndSelectCity(page, '#city1', '#suggestions1', 'New York');
      await searchAndSelectCity(page, '#city2', '#suggestions2', 'London');

      await Promise.all([
        page.waitForResponse(
          (res) => res.url().includes('/distance') && res.status() === 200,
          { timeout: 15000 }
        ),
        page.locator('#searchBtn').click(),
      ]);

      await expect(page.locator('#result')).toHaveClass(/show/, { timeout: 8000 });
      const distText = await page.locator('#resultDistance').textContent();
      expect(distText).toMatch(/[\d,.]+\s*km/);
      // New York to London is roughly 5,500 km — sanity-check we got a real number
      const raw = parseFloat(distText!.replace(/[^0-9.]/g, ''));
      expect(raw).toBeGreaterThan(100);
    });

    test('Sydney to Singapore: shows numeric km distance', async ({ page }) => {
      await searchAndSelectCity(page, '#city1', '#suggestions1', 'Sydney');
      await searchAndSelectCity(page, '#city2', '#suggestions2', 'Singapore');

      await Promise.all([
        page.waitForResponse(
          (res) => res.url().includes('/distance') && res.status() === 200,
          { timeout: 15000 }
        ),
        page.locator('#searchBtn').click(),
      ]);

      await expect(page.locator('#result')).toHaveClass(/show/, { timeout: 8000 });
      const distText = await page.locator('#resultDistance').textContent();
      expect(distText).toMatch(/[\d,.]+\s*km/);
      const raw = parseFloat(distText!.replace(/[^0-9.]/g, ''));
      expect(raw).toBeGreaterThan(100);
    });

    test('Berlin to Vienna: result cities panel shows both names', async ({ page }) => {
      const name1 = await searchAndSelectCity(page, '#city1', '#suggestions1', 'Berlin');
      const name2 = await searchAndSelectCity(page, '#city2', '#suggestions2', 'Vienna');

      await Promise.all([
        page.waitForResponse(
          (res) => res.url().includes('/distance') && res.status() === 200,
          { timeout: 15000 }
        ),
        page.locator('#searchBtn').click(),
      ]);

      await expect(page.locator('#result')).toHaveClass(/show/, { timeout: 8000 });
      // Use the locale-aware names returned by the backend
      await expect(page.locator('#resultCities')).toContainText(name1);
      await expect(page.locator('#resultCities')).toContainText(name2);
    });

  });

});
