import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useResetPassword } from "@workspace/api-client-react";
import { toast } from "sonner";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const resetPasswordMutation = useResetPassword();

  // Extract token from URL search params
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token") || "";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error("Invalid reset token");
      return;
    }
    resetPasswordMutation.mutate({ data: { token, password } }, {
      onSuccess: () => {
        toast.success("Password reset successfully");
        setLocation("/login");
      },
      onError: () => {
        toast.error("Failed to reset password");
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">Set new password</h1>
          <p className="text-muted-foreground mt-2">Enter your new password below</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <Input 
              id="password" 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              minLength={6}
            />
          </div>
          
          <Button 
            type="submit" 
            className="w-full" 
            disabled={resetPasswordMutation.isPending || !token}
          >
            {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
