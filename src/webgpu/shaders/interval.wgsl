// Interval struct and functions for WGSL shaders

struct Interval {
  min: f32,
  max: f32,
};

fn interval_universe() -> Interval {
  return Interval(-INF, INF);
}

fn interval_empty() -> Interval {
  return Interval(INF, -INF);
}

fn interval_ahead() -> Interval {
  return Interval(0.0, RAY_TMAX);
}

fn interval_size(interval: Interval) -> f32 {
  return interval.max - interval.min;
}
// returns true if the value is within the interval, boundaries included
fn interval_contains(interval: Interval, value: f32) -> bool {
  return (value >= interval.min && value <= interval.max);
}
// returns true if the value is inside the interval, boundaries excluded
fn interval_surrounds(interval: Interval, value: f32) -> bool {
  return (value > interval.min && value < interval.max);
}
