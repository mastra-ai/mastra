import { HeroSection } from '@/components/landing/HeroSection';
import { FeaturesGrid } from '@/components/landing/FeaturesGrid';
import { SocialProof } from '@/components/landing/SocialProof';
import { PricingCards } from '@/components/landing/PricingCards';
import { InteractiveDemo } from '@/components/landing/InteractiveDemo';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-gray-900">
      <HeroSection />
      <SocialProof />
      <FeaturesGrid />
      <InteractiveDemo />
      <PricingCards />
    </main>
  );
}
