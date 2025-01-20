import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const resetSchema = z.object({
  email: z.string().email("Invalid email").refine(
    (email) => email.endsWith("acibadem.edu.tr") || email.endsWith("live.acibadem.edu.tr"),
    { message: "Email must be from acibadem.edu.tr or live.acibadem.edu.tr domain" }
  ),
});

const confirmResetSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type ResetFormData = z.infer<typeof resetSchema>;
type ConfirmResetFormData = z.infer<typeof confirmResetSchema>;

async function requestReset(email: string): Promise<{ ok: boolean; message: string }> {
  try {
    const response = await fetch("/api/reset-password/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!response.ok && response.status !== 400) {
      throw new Error("Failed to request password reset");
    }

    const message = await response.text();
    return { ok: response.ok, message };
  } catch (error: any) {
    return { ok: false, message: error.message };
  }
}

async function confirmReset(token: string, password: string): Promise<{ ok: boolean; message: string }> {
  try {
    const response = await fetch(`/api/reset-password/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (!response.ok && response.status !== 400) {
      throw new Error("Failed to reset password");
    }

    const message = await response.text();
    return { ok: response.ok, message };
  } catch (error: any) {
    return { ok: false, message: error.message };
  }
}

export default function ResetPassword() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const [requestSent, setRequestSent] = useState(false);
  const token = window.location.pathname.split("/reset-password/")[1];

  const resetForm = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
    defaultValues: { email: "" },
  });

  const confirmForm = useForm<ConfirmResetFormData>({
    resolver: zodResolver(confirmResetSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onRequestSubmit = async (data: ResetFormData) => {
    const result = await requestReset(data.email);
    toast({
      variant: result.ok ? "default" : "destructive",
      title: result.ok ? "Success" : "Error",
      description: result.message,
    });
    if (result.ok) {
      setRequestSent(true);
    }
  };

  const onConfirmSubmit = async (data: ConfirmResetFormData) => {
    if (!token) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Invalid reset token",
      });
      return;
    }

    const result = await confirmReset(token, data.password);
    toast({
      variant: result.ok ? "default" : "destructive",
      title: result.ok ? "Success" : "Error",
      description: result.message,
    });

    if (result.ok) {
      setTimeout(() => setLocation("/"), 1500);
    }
  };

  if (token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Reset Password</CardTitle>
            <CardDescription className="text-center">
              Enter your new password
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...confirmForm}>
              <form onSubmit={confirmForm.handleSubmit(onConfirmSubmit)} className="space-y-4">
                <FormField
                  control={confirmForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={confirmForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full">
                  Reset Password
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">Reset Password</CardTitle>
          <CardDescription className="text-center">
            {requestSent
              ? "Check your email for the reset link"
              : "Enter your email to receive a password reset link"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!requestSent && (
            <Form {...resetForm}>
              <form onSubmit={resetForm.handleSubmit(onRequestSubmit)} className="space-y-4">
                <FormField
                  control={resetForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full">
                  Send Reset Link
                </Button>
              </form>
            </Form>
          )}

          <div className="mt-4 text-center">
            <Button
              variant="link"
              onClick={() => setLocation("/")}
              className="text-sm text-muted-foreground hover:text-primary"
            >
              Back to Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
