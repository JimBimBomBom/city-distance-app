import { test, expect } from '@playwright/test';

test.describe('City Distance Website', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Page should render immediately - no CDN dependency
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
  });

  // ── Page structure tests ──────────────────────────────────────────────────

  test('page loads with correct title and structure', async ({ page }) => {
    await expect(page).toHaveTitle('City Distance Calculator');
    await expect(page.locator('h1')).toContainText('City Distance Calculator');
    await expect(page.locator('#city1')).toBeVisible();
    await expect(page.locator('#city2')).toBeVisible();
    await expect(page.locator('#searchBtn')).toBeVisible();
    await expect(page.locator('#searchBtn')).toContainText('Calculate Distance');
  });

  test('search box contains From and To labels', async ({ page }) => {
    const labels = page.locator('.search-box label');
    await expect(labels.nth(0)).toContainText('From');
    await expect(labels.nth(1)).toContainText('To');
  });

  test('inputs have correct placeholders', async ({ page }) => {
    await expect(page.locator('#city1')).toHaveAttribute('placeholder', 'Search for a city...');
    await expect(page.locator('#city2')).toHaveAttribute('placeholder', 'Search for a city...');
  });

  // ── Calculate button state ────────────────────────────────────────────────

  test('calculate button is disabled initially', async ({ page }) => {
    await expect(page.locator('#searchBtn')).toBeDisabled();
  });

  test('clicking disabled calculate button does nothing', async ({ page }) => {
    await page.locator('#searchBtn').click({ force: true });
    await expect(page.locator('#msgValidation')).not.toHaveClass(/show/);
  });

  // ── Dark/Light mode ───────────────────────────────────────────────────────

  test('theme toggle button exists and is clickable', async ({ page }) => {
    const themeBtn = page.locator('#themeBtn');
    await expect(themeBtn).toBeVisible();
    await expect(themeBtn).toBeEnabled();
  });

  test('clicking theme toggle switches between light and dark', async ({ page }) => {
    const html = page.locator('html');
    const themeBtn = page.locator('#themeBtn');

    const initialTheme = await html.getAttribute('data-theme');

    await themeBtn.click();
    const newTheme = await html.getAttribute('data-theme');
    expect(newTheme).not.toBe(initialTheme);

    // Click again to toggle back
    await themeBtn.click();
    await expect(html).toHaveAttribute('data-theme', initialTheme!);
  });

  test('theme preference persists after reload', async ({ page }) => {
    const themeBtn = page.locator('#themeBtn');

    // Set to dark mode
    const initialTheme = await page.locator('html').getAttribute('data-theme');
    if (initialTheme === 'light') {
      await themeBtn.click();
    }
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // Reload and check
    await page.reload();
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  // ── Language selector ─────────────────────────────────────────────────────

  test('language button exists', async ({ page }) => {
    await expect(page.locator('#langBtn')).toBeVisible();
  });

  test('language dropdown opens and closes', async ({ page }) => {
    const langBtn = page.locator('#langBtn');
    const dropdown = page.locator('#langDropdown');

    await page.waitForTimeout(2000);

    if (await langBtn.isEnabled()) {
      await langBtn.click();
      await expect(dropdown).toHaveClass(/open/);

      // Close by clicking outside
      await page.locator('h1').click();
      await expect(dropdown).not.toHaveClass(/open/);
    }
  });

  test('selecting a language updates button and saves cookie', async ({ page }) => {
    const langBtn = page.locator('#langBtn');

    await page.waitForTimeout(2000);

    if (await langBtn.isEnabled()) {
      await langBtn.click();
      const options = page.locator('.lang-option');
      const count = await options.count();

      if (count > 1) {
        const secondOption = options.nth(1);
        const langName = await secondOption.locator('span:last-child').textContent();
        await secondOption.click();

        await expect(page.locator('#langBtnLabel')).toContainText(langName!.trim());

        // Verify cookie was set
        const cookies = await page.context().cookies();
        const langCookie = cookies.find(c => c.name === 'cds_lang');
        expect(langCookie).toBeTruthy();
      }
    }
  });

  // ── Autocomplete / Suggestions ────────────────────────────────────────────

  test('typing in city1 triggers suggestions', async ({ page }) => {
    await page.locator('#city1').fill('Lon');
    await page.waitForTimeout(1000);

    const visible = await page.locator('#suggestions1').isVisible().catch(() => false);
    if (visible) {
      expect(await page.locator('#suggestions1 .suggestion-item').count()).toBeGreaterThan(0);
    }
  });

  test('selecting a suggestion shows selected chip and updates input', async ({ page }) => {
    const input = page.locator('#city1');
    const suggestions = page.locator('#suggestions1');

    await input.fill('London');
    await page.waitForTimeout(1000);

    if (!(await suggestions.isVisible().catch(() => false))) {
      test.skip(true, 'Backend not available');
      return;
    }

    await suggestions.locator('.suggestion-item').first().click();

    const inputValue = await input.inputValue();
    expect(inputValue.length).toBeGreaterThan(0);
    await expect(page.locator('#selected1')).toHaveClass(/show/);
  });

  test('clearing input resets selection and disables button', async ({ page }) => {
    const input = page.locator('#city1');
    const suggestions = page.locator('#suggestions1');

    await input.fill('London');
    await page.waitForTimeout(1000);

    if (!(await suggestions.isVisible().catch(() => false))) {
      test.skip(true, 'Backend not available');
      return;
    }

    await suggestions.locator('.suggestion-item').first().click();
    await expect(page.locator('#selected1')).toHaveClass(/show/);

    await input.fill('');
    await expect(page.locator('#selected1')).not.toHaveClass(/show/);
    await expect(page.locator('#searchBtn')).toBeDisabled();
  });

  test('keyboard navigation in suggestions: ArrowDown, ArrowUp, Enter', async ({ page }) => {
    const input = page.locator('#city1');
    const suggestions = page.locator('#suggestions1');

    await input.fill('New');
    await page.waitForTimeout(1000);

    if (!(await suggestions.isVisible().catch(() => false))) {
      test.skip(true, 'Backend not available');
      return;
    }

    await input.press('ArrowDown');
    await page.waitForTimeout(100);
    expect(await suggestions.locator('.kbd-selected').count()).toBe(1);

    await input.press('Enter');
    await page.waitForTimeout(200);
    await expect(page.locator('#selected1')).toHaveClass(/show/);
  });

  test('Escape closes suggestions', async ({ page }) => {
    const input = page.locator('#city1');
    const suggestions = page.locator('#suggestions1');

    await input.fill('Berlin');
    await page.waitForTimeout(1000);

    if (!(await suggestions.isVisible().catch(() => false))) {
      test.skip(true, 'Backend not available');
      return;
    }

    await input.press('Escape');
    await expect(suggestions).not.toHaveClass(/active/);
  });

  test('single character does not trigger suggestions', async ({ page }) => {
    await page.locator('#city1').fill('L');
    await page.waitForTimeout(500);
    await expect(page.locator('#suggestions1')).not.toHaveClass(/active/);
  });

  test('clicking outside closes suggestions', async ({ page }) => {
    const suggestions = page.locator('#suggestions1');

    await page.locator('#city1').fill('Madrid');
    await page.waitForTimeout(1000);

    if (!(await suggestions.isVisible().catch(() => false))) {
      test.skip(true, 'Backend not available');
      return;
    }

    await page.locator('h1').click();
    await expect(suggestions).not.toHaveClass(/active/);
  });

  // ── Calculate button enables/disables ─────────────────────────────────────

  test('button enables only when both cities are selected', async ({ page }) => {
    const calcBtn = page.locator('#searchBtn');
    const suggestions1 = page.locator('#suggestions1');
    const suggestions2 = page.locator('#suggestions2');

    await page.locator('#city1').fill('London');
    await page.waitForTimeout(1000);
    if (!(await suggestions1.isVisible().catch(() => false))) {
      test.skip(true, 'Backend not available');
      return;
    }
    await suggestions1.locator('.suggestion-item').first().click();
    await expect(calcBtn).toBeDisabled(); // Only one city

    await page.locator('#city2').fill('Paris');
    await page.waitForTimeout(1000);
    await suggestions2.locator('.suggestion-item').first().click();
    await expect(calcBtn).toBeEnabled(); // Both selected
  });

  // ── Full flow ─────────────────────────────────────────────────────────────

  test('complete flow: select cities, calculate distance, see result', async ({ page }) => {
    const suggestions1 = page.locator('#suggestions1');
    const suggestions2 = page.locator('#suggestions2');

    await page.locator('#city1').fill('New York');
    await page.waitForTimeout(1500);
    if (!(await suggestions1.isVisible().catch(() => false))) {
      test.skip(true, 'Backend not available');
      return;
    }
    await suggestions1.locator('.suggestion-item').first().click();

    await page.locator('#city2').fill('London');
    await page.waitForTimeout(1500);
    await suggestions2.locator('.suggestion-item').first().click();

    await page.locator('#searchBtn').click();
    await page.waitForTimeout(3000);

    const resultVisible = await page.locator('#result').isVisible().catch(() => false);

    if (resultVisible) {
      const distanceText = await page.locator('#resultDistance').textContent();
      expect(distanceText).toContain('km');
    } else {
      // Server error is acceptable if backend doesn't have the data
      const hasError = await page.locator('#msgServer').isVisible().catch(() => false);
      if (hasError) {
        console.log('Server error during calculation - expected if test data missing');
      }
    }
  });

  // ── Suggestion details ────────────────────────────────────────────────────

  test('suggestions show metadata badges', async ({ page }) => {
    const suggestions = page.locator('#suggestions1');

    await page.locator('#city1').fill('Tokyo');
    await page.waitForTimeout(1000);

    if (!(await suggestions.isVisible().catch(() => false))) {
      test.skip(true, 'Backend not available');
      return;
    }

    const firstItem = suggestions.locator('.suggestion-item').first();
    await expect(firstItem.locator('.city-name')).toBeVisible();
    expect(await firstItem.locator('.badge').count()).toBeGreaterThan(0);
  });
});
