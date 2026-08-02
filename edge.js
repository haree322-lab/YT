import * as BunnySDK from "@bunny.net/edgescript-sdk";

// Bunny.net Edge Scripting entry point
// This simple standalone script will respond to requests on your edge domain.

BunnySDK.net.http.serve(async (request) => {
  const url = new URL(request.url);
  
  return new Response(`Welcome to YouTube Live Studio Edge Endpoint!\nPath requested: ${url.pathname}`, {
    status: 200,
    headers: { 
      "content-type": "text/plain; charset=utf-8",
      "x-powered-by": "Bunny.net Edge Scripting"
    },
  });
});
