import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import { useUser } from "@/hooks/use-user";
import AuthPage from "@/pages/auth-page";
import ResetPassword from "@/pages/reset-password";
import Home from "@/pages/home";
import EmergencySim from "@/pages/emergency-sim";
import ClinicalSim from "@/pages/clinical-sim";
import NavigationBar from "@/components/navigation-bar";
import WelcomeBadge from "@/components/WelcomeBadge";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

function Router() {
  const { user, isLoading } = useUser();
  const [showWelcome, setShowWelcome] = useState(false);

  // Show welcome badge when user logs in
  useEffect(() => {
    console.log("User state changed:", user?.id);
    if (user?.id) {
      console.log("Showing welcome badge");
      setShowWelcome(true);
    }
  }, [user?.id]); // Watch user.id instead of user object

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Allow access to reset password pages without authentication
  if (window.location.pathname.startsWith("/reset-password")) {
    return <ResetPassword />;
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-background">
      {showWelcome && (
        <WelcomeBadge
          username={user.username}
          onClose={() => setShowWelcome(false)}
        />
      )}
      <NavigationBar />
      <main className="container mx-auto px-4 py-8">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/emergency" component={EmergencySim} />
          <Route path="/clinical" component={ClinicalSim} />
          <Route path="/reset-password" component={ResetPassword} />
          <Route path="/reset-password/:token" component={ResetPassword} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;