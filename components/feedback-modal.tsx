'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { MessageSquare } from 'lucide-react';

export function FeedbackModal() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [email, setEmail] = useState('');
    const [includeEmail, setIncludeEmail] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async () => {
        if (!message.trim()) return;

        setLoading(true);
        try {
            const response = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: message.trim(),
                    email: includeEmail && email.trim() ? email.trim() : undefined,
                }),
            });

            if (response.ok) {
                setSubmitted(true);
                setTimeout(() => {
                    setOpen(false);
                    setMessage('');
                    setEmail('');
                    setIncludeEmail(false);
                    setSubmitted(false);
                }, 2000);
            }
        } catch (error) {
            console.error('Error submitting feedback:', error);
        } finally {
            setLoading(false);
        }
    };

    const isValid = message.trim().length > 0 && (!includeEmail || email.trim().length > 0);

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                type="button"
                className="h-9 px-3 rounded-md border border-zinc-700 bg-transparent text-muted-foreground hover:bg-zinc-800 hover:text-foreground transition-colors cursor-pointer text-sm flex items-center gap-2 w-fit"
            >
                <MessageSquare className="h-4 w-4 flex-shrink-0" />
                {/* <span className="text-xs font-medium whitespace-nowrap">Share Feedback</span> */}
            </button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Share Feedback</DialogTitle>
                        <DialogDescription>
                            Help us improve by sharing your thoughts and suggestions.
                        </DialogDescription>
                    </DialogHeader>

                    {submitted ? (
                        <div className="flex flex-col items-center justify-center py-8 gap-2">
                            <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                                <svg className="h-6 w-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <p className="text-sm font-medium">Thank you for your feedback!</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {/* Message */}
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="message">Message</Label>
                                <Textarea
                                    id="message"
                                    placeholder="Tell us what you think..."
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    className="resize-none outline-none bg-zinc-800 border-zinc-700 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
                                    rows={4}
                                />
                            </div>

                            {/* Email checkbox */}
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="contact"
                                    checked={includeEmail}
                                    onCheckedChange={(checked) => setIncludeEmail(checked as boolean)}
                                    className="bg-zinc-800 border-zinc-700 focus:ring-zinc-600"
                                />
                                <Label htmlFor="contact" className="cursor-pointer text-sm font-normal">
                                    Contact me about this feedback
                                </Label>
                            </div>

                            {/* Email field - only show if checkbox is checked */}
                            {includeEmail && (
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="your@email.com"
                                        value={email}
                                        className="resize-none outline-none bg-zinc-800 border-zinc-700 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>
                            )}

                            {/* Submit button */}
                            <Button
                                onClick={handleSubmit}
                                disabled={!isValid || loading}
                                className="w-full"
                            >
                                {loading ? (
                                    <>
                                        <svg className="h-4 w-4 animate-spin mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        Sending...
                                    </>
                                ) : (
                                    'Send Feedback'
                                )}
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
