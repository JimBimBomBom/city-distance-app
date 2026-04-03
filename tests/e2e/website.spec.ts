import { test, expect, Page } from '@playwright/test';
import LANGUAGES from '../fixtures/languages.json';
import CITIES from '../fixtures/cities.json';

// ---------------------------------------------------------------------------
// Mock constants
// ---------------------------------------------------------------------------

/**
 * Fixed distance value returned by the /distance mock for every city pair.
 * Tests only verify that the frontend displays a sensible number with the
 * correct unit — not that the backend computed it correctly.
 */
const MOCK_DISTANCE_KM = 5570;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Register Playwright route mocks for all three API endpoints.
 * Must be called before page.goto() so the mocks are in place for the
 * initial page load (which triggers /languages immediately).
 */
async function setupMocks(page: Page) {
  // /languages — return fixture list instantly
  await page.route('**/languages', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(LANGUAGES),
    })
  );

  // /suggestions?q=X — prefix-filter the cities fixture
  await page.route('**/suggestions*', route => {
    const q = new URL(route.request().url()).searchParams.get('q')?.toLowerCase() ?? '';
    const matches = CITIES.filter(c => c.name.toLowerCase().startsWith(q));
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(matches),
    });
  });

  // /distance — always return the fixed mock value
  await page.route('**/distance', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ Distance: MOCK_DISTANCE_KM }),
    })
  );
}

/**
 * Type a query into a city input and wait for the suggestions panel to
 * become active.
 *
 * Uses pressSequentially (not fill) so the browser fires oninput events
 * for each character, triggering the app's debounce → getSuggestions() call.
 * waitForResponse matches the mocked /suggestions response, confirming the
 * full round-trip (type → debounce → fetch → mock → DOM render) completed.
 */
async function waitForSuggestions(
  page: Page,
  inputId: string,
  query: string,
  suggestionsId?: string
) {
  const panelId = suggestionsId ?? inputId.replace('#city', '#suggestions');
  await page.locator(inputId).click();
  await page.locator(inputId).clear();
  await Promise.all([
    page.waitForResponse(
      res => res.url().includes('/suggestions') && res.status() === 200,
      { timeout: 10000 }
    ),
    page.locator(inputId).pressSequentially(query, { delay: 20 }),
  ]);
  await expect(page.locator(panelId)).toHaveClass(/active/, { timeout: 5000 });
}

/**
 * Type a query, wait for suggestions, click the first non-disabled result.
 * Returns the displayed city name (from the suggestion item's DOM text).
 */
async function searchAndSelectCity(
  page: Page,
  inputId: string,
  suggestionsId: string,
  query: string
): Promise<string> {
  await waitForSuggestions(page, inputId, query, suggestionsId);
  const panel = page.locator(suggestionsId);
  const firstItem = panel.locator('.suggestion-item:not(.disabled)').first();
  await expect(firstItem).toBeVisible({ timeout: 5000 });
  const cityName = await firstItem.locator('.city-name span').last().textContent();
  await firstItem.click();
  return cityName?.trim() ?? '';
}

/**
 * Select both cities and click Calculate.
 * Waits for the mocked /distance response and the result panel to appear.
 */
async function calculate(page: Page, city1Query: string, city2Query: string) {
  const name1 = await searchAndSelectCity(page, '#city1', '#suggestions1', city1Query);
  const name2 = await searchAndSelectCity(page, '#city2', '#suggestions2', city2Query);
  await Promise.all([
    page.waitForResponse(
      res => res.url().includes('/distance') && res.status() === 200,
      { timeout: 10000 }
    ),
    page.locator('#searchBtn').click(),
  ]);
  await expect(page.locator('#result')).toHaveClass(/show/, { timeout: 5000 });
  return { name1, name2 };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe('City Distance Website', () => {

  test.beforeEach(async ({ page }) => {
    // Mocks must be registered before goto() so /languages is intercepted
    // on the initial page load (the app calls it immediately on startup).
    await setupMocks(page);
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
    // The mock responds instantly; this wait confirms the CDS library has
    // loaded from CDN and chooseLang() has been called with mock data.
    await expect(page.locator('#langBtnLabel')).not.toHaveText('Language', { timeout: 20000 });
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
      await expect(page.locator('#themeBtn')).toBeVisible();
      await expect(page.locator('#themeBtn')).toBeEnabled();
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
      const initial = await html.getAttribute('data-theme');
      await page.locator('#themeBtn').click();
      expect(await html.getAttribute('data-theme')).not.toBe(initial);
    });

    test('clicking theme button twice reverts to original theme', async ({ page }) => {
      const html = page.locator('html');
      const initial = await html.getAttribute('data-theme');
      await page.locator('#themeBtn').click();
      await page.locator('#themeBtn').click();
      await expect(html).toHaveAttribute('data-theme', initial!);
    });

    test('dark mode persists after page reload via cookie', async ({ page }) => {
      const html = page.locator('html');
      if ((await html.getAttribute('data-theme')) === 'light') await page.locator('#themeBtn').click();
      await expect(html).toHaveAttribute('data-theme', 'dark');
      await page.reload();
      await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
      await expect(html).toHaveAttribute('data-theme', 'dark');
    });

    test('light mode persists after page reload via cookie', async ({ page }) => {
      const html = page.locator('html');
      if ((await html.getAttribute('data-theme')) === 'dark') await page.locator('#themeBtn').click();
      await expect(html).toHaveAttribute('data-theme', 'light');
      await page.reload();
      await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
      await expect(html).toHaveAttribute('data-theme', 'light');
    });

  });

  // ── 4. Language selector ──────────────────────────────────────────────────

  test.describe('Language selector', () => {

    test('language dropdown opens on button click', async ({ page }) => {
      await page.locator('#langBtn').click();
      await expect(page.locator('#langDropdown')).toHaveClass(/open/);
    });

    test('language dropdown closes when clicking outside', async ({ page }) => {
      await page.locator('#langBtn').click();
      await expect(page.locator('#langDropdown')).toHaveClass(/open/);
      await page.locator('h1').click();
      await expect(page.locator('#langDropdown')).not.toHaveClass(/open/);
    });

    test('language dropdown closes when clicking the button again', async ({ page }) => {
      const langBtn = page.locator('#langBtn');
      await langBtn.click();
      await expect(page.locator('#langDropdown')).toHaveClass(/open/);
      await langBtn.click();
      await expect(page.locator('#langDropdown')).not.toHaveClass(/open/);
    });

    test('language dropdown shows all mock languages', async ({ page }) => {
      await page.locator('#langBtn').click();
      const options = page.locator('.lang-option');
      await expect(options.first()).toBeVisible({ timeout: 5000 });
      // Fixture has 6 languages
      expect(await options.count()).toBe(LANGUAGES.length);
    });

    test('selecting a language updates the button label', async ({ page }) => {
      await page.locator('#langBtn').click();
      const options = page.locator('.lang-option');
      await expect(options.first()).toBeVisible({ timeout: 5000 });
      const target = options.nth(2); // German
      const langName = await target.locator('span:last-child').textContent();
      await target.click();
      await expect(page.locator('#langBtnLabel')).toContainText(langName!.trim());
    });

    test('selecting a language saves the cds_lang cookie', async ({ page }) => {
      await page.locator('#langBtn').click();
      const options = page.locator('.lang-option');
      await expect(options.first()).toBeVisible({ timeout: 5000 });
      await options.nth(2).click();
      const cookies = await page.context().cookies();
      const langCookie = cookies.find(c => c.name === 'cds_lang');
      expect(langCookie).toBeTruthy();
      expect(langCookie!.value).toBe('de');
    });

    test('selected language option gets active class', async ({ page }) => {
      await page.locator('#langBtn').click();
      const options = page.locator('.lang-option');
      await expect(options.first()).toBeVisible({ timeout: 5000 });
      await options.nth(2).click();
      // Re-open and verify active class persists
      await page.locator('#langBtn').click();
      await expect(options.first()).toBeVisible({ timeout: 5000 });
      expect(await page.locator('.lang-option.active').count()).toBeGreaterThan(0);
    });

    test('language cookie persists after page reload', async ({ page }) => {
      // Select French
      await page.locator('#langBtn').click();
      const options = page.locator('.lang-option');
      await expect(options.first()).toBeVisible({ timeout: 5000 });
      await page.locator('.lang-option[data-code="fr"]').click();
      await expect(page.locator('#langBtnLabel')).toContainText('French');

      await page.reload();
      await expect(page.locator('#langBtnLabel')).not.toHaveText('Language', { timeout: 20000 });
      await expect(page.locator('#langBtnLabel')).toContainText('French');
    });

  });

  // ── 5. Autocomplete — city1 ───────────────────────────────────────────────

  test.describe('Autocomplete — city1', () => {

    test('single character does not trigger suggestions', async ({ page }) => {
      await page.locator('#city1').fill('L');
      await expect(page.locator('#suggestions1')).not.toHaveClass(/active/);
    });

    test('two characters trigger a suggestions API call', async ({ page }) => {
      await waitForSuggestions(page, '#city1', 'Lo');
      // waitForSuggestions already asserts the panel is .active
    });

    test('typing a city name shows matching suggestions from the fixture', async ({ page }) => {
      await waitForSuggestions(page, '#city1', 'Lon');
      const panel = page.locator('#suggestions1');
      expect(await panel.locator('.suggestion-item').count()).toBeGreaterThan(0);
      // Only London starts with "Lon" in our fixture
      await expect(panel.locator('.suggestion-item').first().locator('.city-name')).toContainText('London');
    });

    test('suggestion items show city name and metadata badges', async ({ page }) => {
      await waitForSuggestions(page, '#city1', 'Tokyo');
      const panel = page.locator('#suggestions1');
      const firstItem = panel.locator('.suggestion-item').first();
      await expect(firstItem.locator('.city-name')).toBeVisible();
      expect(await firstItem.locator('.badge').count()).toBeGreaterThan(0);
    });

    test('selecting a suggestion fills the input and shows chip', async ({ page }) => {
      await searchAndSelectCity(page, '#city1', '#suggestions1', 'London');
      expect((await page.locator('#city1').inputValue()).length).toBeGreaterThan(0);
      await expect(page.locator('#selected1')).toHaveClass(/show/);
    });

    test('selected chip contains the city name', async ({ page }) => {
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
      await waitForSuggestions(page, '#city1', 'Madrid');
      await page.locator('#city1').press('Escape');
      await expect(page.locator('#suggestions1')).not.toHaveClass(/active/);
    });

    test('clicking outside closes suggestions panel', async ({ page }) => {
      await waitForSuggestions(page, '#city1', 'Rome');
      await page.locator('h1').click();
      await expect(page.locator('#suggestions1')).not.toHaveClass(/active/);
    });

    test('prefix filtering works — query with no matches shows no panel', async ({ page }) => {
      // 'Xyz' matches nothing in the fixture; the app collapses the panel
      await page.locator('#city1').click();
      await page.locator('#city1').clear();
      await Promise.all([
        page.waitForResponse(res => res.url().includes('/suggestions'), { timeout: 5000 }),
        page.locator('#city1').pressSequentially('Xyz', { delay: 20 }),
      ]);
      await expect(page.locator('#suggestions1')).not.toHaveClass(/active/);
    });

  });

  // ── 6. Autocomplete — city2 ───────────────────────────────────────────────

  test.describe('Autocomplete — city2', () => {

    test('single character does not trigger suggestions', async ({ page }) => {
      await page.locator('#city2').fill('P');
      await expect(page.locator('#suggestions2')).not.toHaveClass(/active/);
    });

    test('typing a city name shows matching suggestions', async ({ page }) => {
      await waitForSuggestions(page, '#city2', 'Par');
      expect(await page.locator('#suggestions2 .suggestion-item').count()).toBeGreaterThan(0);
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

    test('ArrowDown twice highlights the second item', async ({ page }) => {
      await waitForSuggestions(page, '#city1', 'New');
      const panel = page.locator('#suggestions1');
      const items = panel.locator('.suggestion-item');
      if (await items.count() < 2) {
        test.skip(true, 'Need ≥2 suggestion items');
        return;
      }
      await page.locator('#city1').press('ArrowDown');
      await page.locator('#city1').press('ArrowDown');
      await expect(items.nth(1)).toHaveClass(/kbd-selected/);
    });

    test('Enter on a highlighted item selects it', async ({ page }) => {
      await waitForSuggestions(page, '#city1', 'New');
      await page.locator('#city1').press('ArrowDown');
      await page.locator('#city1').press('Enter');
      await expect(page.locator('#selected1')).toHaveClass(/show/, { timeout: 5000 });
    });

    test('ArrowUp from unselected state highlights a suggestion item', async ({ page }) => {
      await waitForSuggestions(page, '#city1', 'New');
      await page.locator('#city1').press('ArrowUp');
      await expect(page.locator('#suggestions1 .kbd-selected')).toHaveCount(1);
    });

  });

  // ── 8. Duplicate city prevention ─────────────────────────────────────────

  test.describe('Duplicate city prevention', () => {

    test('city selected in city1 appears disabled in city2 suggestions', async ({ page }) => {
      await searchAndSelectCity(page, '#city1', '#suggestions1', 'London');
      await waitForSuggestions(page, '#city2', 'London');
      const disabled = page.locator('#suggestions2 .suggestion-item.disabled');
      expect(await disabled.count()).toBeGreaterThan(0);
    });

    test('clicking a disabled duplicate shows a validation message', async ({ page }) => {
      await searchAndSelectCity(page, '#city1', '#suggestions1', 'London');
      await waitForSuggestions(page, '#city2', 'London');
      await page.locator('#suggestions2 .suggestion-item.disabled').first().click();
      await expect(page.locator('#msgValidation')).toHaveClass(/show/, { timeout: 5000 });
    });

    test('calculate button stays disabled when the same city is attempted for both inputs', async ({ page }) => {
      await searchAndSelectCity(page, '#city1', '#suggestions1', 'London');
      await waitForSuggestions(page, '#city2', 'London');
      const disabled = page.locator('#suggestions2 .suggestion-item.disabled').first();
      if (await disabled.count() > 0) {
        await disabled.click();
        await expect(page.locator('#searchBtn')).toBeDisabled();
      }
    });

  });

  // ── 9. Calculate flow ─────────────────────────────────────────────────────

  test.describe('Calculate flow', () => {

    test('loading indicator appears while calculating', async ({ page }) => {
      await searchAndSelectCity(page, '#city1', '#suggestions1', 'London');
      await searchAndSelectCity(page, '#city2', '#suggestions2', 'Paris');
      await Promise.all([
        page.waitForResponse(res => res.url().includes('/distance'), { timeout: 10000 }),
        page.locator('#searchBtn').click(),
      ]);
      await expect(page.locator('#loading')).not.toHaveClass(/show/, { timeout: 5000 });
    });

    test('result panel shows after calculation', async ({ page }) => {
      await calculate(page, 'London', 'Paris');
      await expect(page.locator('#result')).toHaveClass(/show/);
    });

    test('result distance contains "km"', async ({ page }) => {
      await calculate(page, 'London', 'Paris');
      await expect(page.locator('#resultDistance')).toContainText('km');
    });

    test('result distance is a positive number', async ({ page }) => {
      await calculate(page, 'London', 'Paris');
      const text = await page.locator('#resultDistance').textContent();
      const val = parseFloat(text!.replace(/[^0-9.]/g, ''));
      expect(val).toBeGreaterThan(0);
    });

    test('result cities panel shows both selected city names', async ({ page }) => {
      const { name1, name2 } = await calculate(page, 'London', 'Paris');
      await expect(page.locator('#resultCities')).toContainText(name1);
      await expect(page.locator('#resultCities')).toContainText(name2);
    });

    test('calculate button is re-enabled after calculation', async ({ page }) => {
      await calculate(page, 'Tokyo', 'Seoul');
      await expect(page.locator('#searchBtn')).toBeEnabled({ timeout: 5000 });
    });

    test('calculating a second pair clears the previous result first', async ({ page }) => {
      await calculate(page, 'London', 'Paris');
      await expect(page.locator('#result')).toHaveClass(/show/);

      // Clear inputs and calculate again
      await page.locator('#city1').fill('');
      await page.locator('#city2').fill('');
      await calculate(page, 'Tokyo', 'Seoul');

      // Result must show the new city names, not the old ones
      await expect(page.locator('#resultCities')).not.toContainText('London');
      await expect(page.locator('#resultCities')).toContainText('Tokyo');
    });

  });

  // ── 10. Full end-to-end round-trips ───────────────────────────────────────

  test.describe('Full end-to-end round-trips', () => {

    test('New York to London — result shows km distance', async ({ page }) => {
      await calculate(page, 'New York', 'London');
      const text = await page.locator('#resultDistance').textContent();
      expect(text).toMatch(/[\d,.]+\s*km/);
      expect(parseFloat(text!.replace(/[^0-9.]/g, ''))).toBeGreaterThan(100);
    });

    test('Sydney to Singapore — result shows km distance', async ({ page }) => {
      await calculate(page, 'Sydney', 'Singapore');
      const text = await page.locator('#resultDistance').textContent();
      expect(text).toMatch(/[\d,.]+\s*km/);
      expect(parseFloat(text!.replace(/[^0-9.]/g, ''))).toBeGreaterThan(100);
    });

    test('Berlin to Vienna — result panel shows both city names', async ({ page }) => {
      const { name1, name2 } = await calculate(page, 'Berlin', 'Vienna');
      await expect(page.locator('#resultCities')).toContainText(name1);
      await expect(page.locator('#resultCities')).toContainText(name2);
    });

    test('Mumbai to São Paulo — result panel shows both city names', async ({ page }) => {
      const { name1, name2 } = await calculate(page, 'Mumbai', 'São Paulo');
      await expect(page.locator('#resultCities')).toContainText(name1);
      await expect(page.locator('#resultCities')).toContainText(name2);
    });

  });

});
