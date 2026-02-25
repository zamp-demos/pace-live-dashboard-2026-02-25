/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                GRAY_20: 'var(--GRAY_20)',
                GRAY_50: 'var(--GRAY_50)',
                GRAY_70: 'var(--GRAY_70)',
                GRAY_80: 'var(--GRAY_80)',
                GRAY_100: 'var(--GRAY_100)',
                GRAY_200: 'var(--GRAY_200)',
                GRAY_300: 'var(--GRAY_300)',
                GRAY_400: 'var(--GRAY_400)',
                GRAY_500: 'var(--GRAY_500)',
                GRAY_550: 'var(--GRAY_550)',
                GRAY_600: 'var(--GRAY_600)',
                GRAY_700: 'var(--GRAY_700)',
                GRAY_800: 'var(--GRAY_800)',
                GRAY_900: 'var(--GRAY_900)',
                GRAY_950: 'var(--GRAY_950)',
                GRAY_1000: 'var(--GRAY_1000)',
                BLUE_900: 'var(--BLUE_900)',
                GREEN_700: 'var(--GREEN_700)',
                ORANGE_600: 'var(--ORANGE_600)',
                RED_600: 'var(--RED_600)',
                primary: '#1a1a1a',
                secondary: '#f3f4f6',
            },
            keyframes: {
                'grid-flow': {
                    '0%, 100%': { transform: 'translate(0, 0)' },
                    '25%': { transform: 'translate(-2%, -2%)' },
                    '50%': { transform: 'translate(2%, -1%)' },
                    '75%': { transform: 'translate(-1%, 2%)' }
                }
            },
            animation: {
                'grid-flow': 'grid-flow 20s ease-in-out infinite'
            }
        },
    },
    plugins: [],
}