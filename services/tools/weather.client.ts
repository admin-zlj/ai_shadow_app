/**
 * 城市天气（工具 3 的底层实现）
 *
 * 数据源：Open-Meteo（免费、无需 API Key）
 *   1. geocoding-api — 城市名 → 经纬度
 *   2. forecast API  — 经纬度 → 当前气温、湿度、风力、天气代码
 *
 * 环境变量 WEATHER_DEFAULT_CITY：模型没传 city 或传空时的默认城市（默认「北京」
 */

/** Open-Meteo 返回的 WMO 天气代码 → 中文简述 */
const WMO_WEATHER: Record<number, string> = {
  0: '晴',
  1: '大部晴朗',
  2: '局部多云',
  3: '多云',
  45: '雾',
  48: '雾凇',
  51: '小毛毛雨',
  53: '中毛毛雨',
  55: '大毛毛雨',
  61: '小雨',
  63: '中雨',
  65: '大雨',
  71: '小雪',
  73: '中雪',
  75: '大雪',
  80: '小阵雨',
  81: '中阵雨',
  82: '大阵雨',
  95: '雷暴',
};

interface GeocodeResult {
  results?: Array<{
    name: string;
    latitude: number;
    longitude: number;
    country?: string;
    admin1?: string;
  }>;
}

interface ForecastResult {
  current?: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    weather_code: number;
    wind_speed_10m: number;
  };
}

export async function queryCityWeather(city: string): Promise<string> {
  const name = city.trim() || process.env.WEATHER_DEFAULT_CITY?.trim() || '北京';
  if (!name) {
    return JSON.stringify({ ok: false, error: '请提供城市名称' });
  }

  try {
    const geoUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
    geoUrl.searchParams.set('name', name);
    geoUrl.searchParams.set('count', '1');
    geoUrl.searchParams.set('language', 'zh');

    const geoRes = await fetch(geoUrl.toString());
    if (!geoRes.ok) {
      return JSON.stringify({ ok: false, error: `地理编码失败: ${geoRes.status}` });
    }

    const geo = (await geoRes.json()) as GeocodeResult;
    const place = geo.results?.[0];
    if (!place) {
      return JSON.stringify({
        ok: false,
        error: `未找到城市「${name}」，请换一个更具体的地名`,
      });
    }

    const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast');
    forecastUrl.searchParams.set('latitude', String(place.latitude));
    forecastUrl.searchParams.set('longitude', String(place.longitude));
    forecastUrl.searchParams.set(
      'current',
      'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m',
    );
    forecastUrl.searchParams.set('timezone', 'auto');

    const forecastRes = await fetch(forecastUrl.toString());
    if (!forecastRes.ok) {
      return JSON.stringify({
        ok: false,
        error: `天气查询失败: ${forecastRes.status}`,
      });
    }

    const forecast = (await forecastRes.json()) as ForecastResult;
    const current = forecast.current;
    if (!current) {
      return JSON.stringify({ ok: false, error: '未返回当前天气数据' });
    }

    const label =
      WMO_WEATHER[current.weather_code] ?? `天气代码 ${current.weather_code}`;

    return JSON.stringify({
      ok: true,
      city: place.name,
      region: place.admin1,
      country: place.country,
      observedAt: current.time,
      weather: label,
      temperatureC: current.temperature_2m,
      humidityPercent: current.relative_humidity_2m,
      windSpeedKmh: current.wind_speed_10m,
    });
  } catch (error) {
    return JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
