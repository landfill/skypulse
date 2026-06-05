'use client';

import { useState, useEffect } from 'react';
import type { GeoLocation } from '@/lib/types';

const SEOUL_FALLBACK: GeoLocation = {
  lat: 37.5665,
  lng: 126.9780,
  isFallback: true,
};

export function useGeolocation(): GeoLocation {
  const [location, setLocation] = useState<GeoLocation>(SEOUL_FALLBACK);

  useEffect(() => {
    if (!navigator.geolocation) {
      // geolocation API 미지원 → 서울 폴백 유지
      return;
    }

    let watchId: number | null = null;

    const onSuccess = (pos: GeolocationPosition) => {
      setLocation({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        isFallback: false,
      });
    };

    const onError = () => {
      // 권한 거부 or 타임아웃 → 서울 폴백 유지
      setLocation(SEOUL_FALLBACK);
    };

    const options: PositionOptions = {
      enableHighAccuracy: false,
      timeout: 10_000,
      maximumAge: 30_000,
    };

    // 1회 조회 후 watch
    navigator.geolocation.getCurrentPosition(onSuccess, onError, options);
    watchId = navigator.geolocation.watchPosition(onSuccess, onError, options);

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  return location;
}
