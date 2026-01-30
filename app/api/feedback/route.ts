import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
    const { message, email } = await req.json();

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return Response.json({ success: false, error: 'Message is required' }, { status: 400 });
    }

    try {
        await resend.emails.send({
            from: "FIU Atlas Feedback <onboarding@resend.dev>",
            to: ["mail@anthonymham.com"],
            replyTo: email || "no-reply@fiu-atlas.local",
            subject: `Feedback from FIU Atlas${email ? ` — ${email}` : ''}`,
            text: `
Message:
${message}

${email ? `Reply to: ${email}` : 'Anonymous submission (no email provided)'}
      `,
        });

        return Response.json({ success: true });
    } catch (error) {
        console.error('Feedback submission error:', error);
        return Response.json({ success: false, error: 'Failed to send feedback' }, { status: 500 });
    }
}