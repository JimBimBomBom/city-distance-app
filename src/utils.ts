/**
 * Flag utility functions for rendering country flags as emojis or codes
 */
export class FlagUtils {
  private static _flagOk: boolean | null = null;

  /**
   * Convert a 2-letter country code to a flag emoji
   */
  static toFlagEmoji(value: string | null | undefined): string {
    if (!value) return '';
    if ([...value].some(c => c.codePointAt(0)! > 0x7F)) return value; // already emoji
    if (/^[A-Za-z]{2}$/.test(value))
      return [...value.toUpperCase()]
        .map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
        .join('');
    return value;
  }

  /**
   * Check if the browser can render flag emojis properly
   */
  static canRenderFlags(): boolean {
    if (FlagUtils._flagOk !== null) return FlagUtils._flagOk;
    try {
      const c = document.createElement('canvas');
      c.width = c.height = 16;
      const ctx = c.getContext('2d');
      if (!ctx) {
        FlagUtils._flagOk = true;
        return FlagUtils._flagOk;
      }
      ctx.font = '14px serif';
      ctx.fillText('🇺🇸', 0, 14);
      const imageData = ctx.getImageData(0, 0, 16, 16).data;
      FlagUtils._flagOk = imageData.some((p: number) => p !== 0);
    } catch {
      FlagUtils._flagOk = true;
    }
    return FlagUtils._flagOk as boolean;
  }

  /**
   * Render a flag as HTML - uses emoji if supported, otherwise shows country code
   */
  static renderFlag(rawFlag: string | null | undefined, countryCode: string | null | undefined): string {
    const code = (countryCode || rawFlag || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
    const emoji = FlagUtils.toFlagEmoji(rawFlag || countryCode || '');
    if (!emoji && !code) return '';
    if (emoji && FlagUtils.canRenderFlags())
      return `<span class="flag-emoji" aria-label="${code} flag">${emoji}</span>`;
    return (emoji ? `<span class="flag-emoji" aria-hidden="true">${emoji}</span>` : '')
         + (code ? `<span class="flag-code">${code}</span>` : '');
  }
}

/**
 * Format utility functions for numbers, dates, etc.
 */
export class FormatUtils {
  /**
   * Format population number with K/M suffixes
   */
  static fmtPop(n: number | null | undefined): string {
    if (n === null || n === undefined) return '';
    if (n >= 1_000_000) return `${(n / 1e6).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1e3).toFixed(0)}K`;
    return String(n);
  }

  /**
   * Format distance with locale-aware number formatting
   */
  static fmtDistance(distance: number, decimals: number = 2): string {
    return Number(distance).toLocaleString(undefined, { maximumFractionDigits: decimals });
  }
}
