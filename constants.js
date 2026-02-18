export const DEPARTMENTS = ['Computer Science', 'Information Technology', 'Electronics', 'Mechanical', 'Civil'];
export const DIVISIONS = ['A', 'B', 'C', 'D'];
export const YEARS = ['1', '2', '3', '4'];
export const getSemestersForYear = (year) => {
  const y = String(year || '');
  if (y === '1') return ['1', '2'];
  if (y === '2') return ['3', '4'];
  if (y === '3') return ['5', '6'];
  if (y === '4') return ['7', '8'];
  return [];
};
