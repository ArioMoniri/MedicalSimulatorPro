import { createContext, useContext, useState, ReactNode } from 'react';
import WelcomeBadge from '@/components/WelcomeBadge';

interface WelcomeBadgeContextType {
  showWelcomeBadge: (username: string) => void;
}

const WelcomeBadgeContext = createContext<WelcomeBadgeContextType | undefined>(undefined);

export function WelcomeBadgeProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(null);

  const showWelcomeBadge = (name: string) => {
    setUsername(name);
  };

  return (
    <WelcomeBadgeContext.Provider value={{ showWelcomeBadge }}>
      {children}
      {username && (
        <WelcomeBadge 
          username={username} 
          onClose={() => setUsername(null)} 
        />
      )}
    </WelcomeBadgeContext.Provider>
  );
}

export function useWelcomeBadge() {
  const context = useContext(WelcomeBadgeContext);
  if (context === undefined) {
    throw new Error('useWelcomeBadge must be used within a WelcomeBadgeProvider');
  }
  return context;
}
