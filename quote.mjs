export function calculate(input, catalog) {
  const profile = catalog.profiles.find(p => p.id === input.profileId);
  if (!profile) throw new Error('აირჩიეთ პროფილი მოქმედი კატალოგიდან.');
  const {width, height, quantity, installation} = input;
  if (![width,height].every(n => typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= 30) || !Number.isInteger(quantity) || quantity < 1 || quantity > 1000 || typeof installation !== 'boolean') throw new Error('შეამოწმეთ ზომები (0–30 მეტრი), რაოდენობა (1–1000) და მონტაჟი.');
  if (!['m2','linear_m','piece'].includes(profile.unit) || typeof profile.rate !== 'number' || !Number.isFinite(profile.rate) || profile.rate < 0 || !profile.approved) throw new Error('ამ პროფილის ტარიფი ჯერ დასადასტურებელია.');
  if (installation && (typeof profile.installationRate !== 'number' || !Number.isFinite(profile.installationRate) || profile.installationRate < 0)) throw new Error('მონტაჟის ტარიფი ჯერ არ არის მითითებული.');
  const units = (profile.unit === 'm2' ? width * height : profile.unit === 'linear_m' ? width : 1) * quantity;
  const material = units * profile.rate;
  const fitting = installation ? units * profile.installationRate : 0;
  const round = n => Math.round((n + Number.EPSILON) * 100) / 100;
  return {profile:profile.name, unit:profile.unit, units:round(units), rate:profile.rate, material:round(material), installation:round(fitting), total:round(material + fitting), currency:catalog.currency, notes:profile.notes || 'საბოლოო ფასი დაზუსტდება აზომვისა და კომპლექტაციის შემდეგ.'};
}
