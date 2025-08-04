import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    {
      cookies: {
        async get(name: string) {
          const cookie = await cookieStore.get(name);
          return cookie?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // The `cookies().set()` method can’t be called from a Server Component if a `redirect()` or `notFound()` is called in the same span. Doing so would render a new `Set-Cookie` header with the redirect status code, which is disallowed by the HTTP spec.
            // This is by design and can be safely ignored if you only intend to set cookies in a Server Action or Route Handler.
            console.error("Error setting cookie in server component:", error);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // The `cookies().set()` method can’t be called from a Server Component if a `redirect()` or `notFound()` is called in the same span. Doing so would render a new `Set-Cookie` header with the redirect status code, which is disallowed by the HTTP spec.
            // This is by design and can be safely ignored if you only intend to set cookies in a Server Action or Route Handler.
            console.error("Error removing cookie in server component:", error);
          }
        },
      },
    }
  );
}
