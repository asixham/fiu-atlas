'use client';

import React from "react"

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'atlas-admin-2026';

export default function SeedPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setPasswordError('');
    } else {
      setPasswordError('Incorrect password');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        setMessage('Please select a CSV file');
        setStatus('error');
        return;
      }
      setSelectedFile(file);
      setMessage('');
      setStatus('idle');
    }
  };

  const handleSeed = async () => {
    if (!selectedFile) {
      setMessage('Please select a CSV file first');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setMessage('Reading and uploading file...');

    try {
      const csvContent = await selectedFile.text();
      
      setMessage('Seeding database...');
      
      const response = await fetch('/api/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': ADMIN_PASSWORD,
        },
        body: JSON.stringify({ csvContent }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setMessage(data.message || 'Database seeded successfully!');
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        setStatus('error');
        setMessage(data.error || 'Failed to seed database');
      }
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  // Password gate
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
        <div className="max-w-sm w-full space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">Admin Access</h1>
            <p className="text-muted-foreground mt-2">Enter password to continue</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full rounded-lg border border-neutral-800 bg-neutral-950 py-2.5 px-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-neutral-700 focus:outline-none focus:ring-1 focus:ring-neutral-700"
                autoFocus
              />
              {passwordError && (
                <p className="text-destructive text-sm mt-2">{passwordError}</p>
              )}
            </div>
            <Button type="submit" className="w-full cursor-pointer">
              Login
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Seed Database</h1>
          <p className="text-muted-foreground mt-2">
            Upload a CSV file to populate the Supabase database with class data.
          </p>
        </div>

        {/* File Upload */}
        <div className="space-y-3">
          <label className="block">
            <span className="text-sm text-muted-foreground mb-2 block">Select CSV File</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-neutral-700 file:text-sm file:font-medium file:bg-neutral-900 file:text-foreground hover:file:bg-neutral-800 file:cursor-pointer cursor-pointer"
            />
          </label>
          
          {selectedFile && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-neutral-900/50 rounded-lg px-3 py-2">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="truncate">{selectedFile.name}</span>
              <span className="text-muted-foreground/60">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
            </div>
          )}
        </div>

        <Button
          onClick={handleSeed}
          disabled={status === 'loading' || !selectedFile}
          className="w-full cursor-pointer"
        >
          {status === 'loading' ? 'Seeding...' : 'Seed Database'}
        </Button>

        {message && (
          <div
            className={`p-4 rounded-lg text-sm ${
              status === 'success'
                ? 'bg-success/15 text-success border border-success/30'
                : status === 'error'
                  ? 'bg-destructive/15 text-destructive border border-destructive/30'
                  : 'bg-neutral-900 text-muted-foreground border border-neutral-800'
            }`}
          >
            {message}
          </div>
        )}

        <div className="pt-4 border-t border-neutral-800">
          <button
            onClick={() => setIsAuthenticated(false)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
