/**
 * Sends /api and the discovery files to the Rails backend.
 * Sends every other path to the calendar-website Worker first, and falls back
 * to the backend when the website returns an error.
 *
 * The discovery files skip the website: Cloudflare fills a missing robots.txt
 * on the website with its own text and a 200, so the fallback never runs.
 */
const BACKEND_PATHS = new Set(["/robots.txt", "/llms.txt", "/sitemap.xml"]);

export default {
  async fetch(request) {
    const originalUrl = new URL(request.url);

    if (
      originalUrl.pathname === "/api" ||
      originalUrl.pathname.startsWith("/api/") ||
      BACKEND_PATHS.has(originalUrl.pathname)
    ) {
      return fetch(request);
    }

    try {
      const pagesDomain = "calendar-home.witcc.workers.dev";
      const pagesUrl = new URL(request.url);
      pagesUrl.hostname = pagesDomain;

      const pagesRequest = new Request(pagesUrl.toString(), request.clone());
      pagesRequest.headers.set("Host", pagesDomain);

      const pagesResponse = await fetch(pagesRequest, { redirect: "manual" });

      if (pagesResponse.status >= 400) {
        return fetch(request);
      }

      if (pagesResponse.status >= 300 && pagesResponse.status < 400) {
        const location = pagesResponse.headers.get("Location");

        if (location && location.includes(pagesDomain)) {
          const newHeaders = new Headers(pagesResponse.headers);
          newHeaders.set("Location", location.replace(pagesDomain, originalUrl.hostname));

          return new Response(pagesResponse.body, {
            status: pagesResponse.status,
            statusText: pagesResponse.statusText,
            headers: newHeaders
          });
        }
      }

      return pagesResponse;
    } catch (error) {
      return fetch(request);
    }
  }
};
