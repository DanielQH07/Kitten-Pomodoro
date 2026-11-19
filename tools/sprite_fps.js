// In ra fps nên dùng cho sprite từ fps nguồn dạng "24/1".
// fps sprite = fps nguồn / số nguyên (gần 12 nhất) để mỗi khung nguồn được lấy đều nhịp, không giật:
//   24 -> 12, 16 -> 16, 30 -> 10, 25 -> 12.5
const [num, den] = String(process.argv[2] || '24/1').split('/').map(Number);
const src = num / (den || 1);
console.log(+(src / Math.max(1, Math.round(src / 12))).toFixed(3));
