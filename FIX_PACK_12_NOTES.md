# Fix Pack 12 Notes

## Included fixes
- Updated `lib/server-auth.ts` for Next.js 15 async cookies API:
  - changed `cookies().get(...)` to `const cookieStore = await cookies(); cookieStore.get(...)`
- Updated `package.json` for Railway deployment:
  - `start` now uses `next start -p $PORT`
  - added `postinstall: prisma generate`
