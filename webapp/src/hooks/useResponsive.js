import { useState, useEffect } from 'react';

/**
 * Hook para detectar tamanho da tela e fornecer breakpoints responsivos
 * Breakpoints Tailwind:
 * - mobile: < 768px (sm)
 * - tablet: 768px - 1024px (md-lg)
 * - desktop: >= 1024px (lg)
 */
export function useResponsive() {
  const [screenSize, setScreenSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  });

  const [deviceType, setDeviceType] = useState('desktop');

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      
      setScreenSize({ width: w, height: h });

      if (w < 768) {
        setDeviceType('mobile');
      } else if (w < 1024) {
        setDeviceType('tablet');
      } else {
        setDeviceType('desktop');
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Call once on mount

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    width: screenSize.width,
    height: screenSize.height,
    isMobile: deviceType === 'mobile',
    isTablet: deviceType === 'tablet',
    isDesktop: deviceType === 'desktop',
    deviceType,
    // Helpers
    isSmallScreen: screenSize.width < 768,
    isMediumScreen: screenSize.width >= 768 && screenSize.width < 1024,
    isLargeScreen: screenSize.width >= 1024,
    isPortrait: screenSize.height > screenSize.width,
    isLandscape: screenSize.width > screenSize.height,
  };
}

export default useResponsive;
