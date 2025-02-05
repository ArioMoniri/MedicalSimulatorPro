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
import { Loader2 } from "lucide-react";
import { WelcomeBadgeProvider } from "@/context/WelcomeBadgeContext";

function Router() {
  const { user, isLoading } = useUser();

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
      <WelcomeBadgeProvider>
        <Router />
        <Toaster />
      </WelcomeBadgeProvider>
    </QueryClientProvider>
  );
}

export default App;