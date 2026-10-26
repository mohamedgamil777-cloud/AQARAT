// Normally the service worker answers this POST and keeps the shared photos.
// If it wasn't running yet, the photos can't be kept, so send the broker to the form with a note.
export async function POST(req: Request, { params }: { params: Promise<{ invite: string }> }) {
  const { invite } = await params;
  return Response.redirect(new URL(`/b/${invite}?shared=lost`, req.url), 303);
}

export async function GET(req: Request, { params }: { params: Promise<{ invite: string }> }) {
  const { invite } = await params;
  return Response.redirect(new URL(`/b/${invite}`, req.url), 303);
}
