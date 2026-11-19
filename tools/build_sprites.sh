#!/usr/bin/env bash
# Video nền xanh -> sprite sheet WebP trong suốt + JSON.  Dùng: bash tools/build_sprites.sh
set -e
cd "$(dirname "$0")/.."
OUT=extension/sprites
SCALE=0.5; FPS=10
# tô logo Gemini (góc phải dưới, ~1160,600) bằng màu nền rồi mới tách nền
LOGO="drawbox=x=1135:y=575:w=50:h=50:color=0x228B51:t=fill"
CROP="crop=1180:610:50:100"
# alpha theo độ vượt trội của kênh G so với R/B; despill kéo G về max(R,B)
KEY="format=rgba,geq=r='r(X,Y)':g='min(g(X,Y),max(r(X,Y),b(X,Y))+4)':b='b(X,Y)':a='255*clip(1-(g(X,Y)-max(r(X,Y),b(X,Y))-12)/30,0,1)'"

make() { # name input start duration
  local name=$1 in=$2 ss=$3 dur=$4 tmp; tmp=$(mktemp -d)
  ffmpeg -v error -y -ss "$ss" -t "$dur" -i "$in" \
    -vf "fps=$FPS,$LOGO,$CROP,scale=iw*$SCALE:ih*$SCALE,$KEY" "$tmp/f%03d.png"
  local n; n=$(ls "$tmp" | wc -l)
  local cols=10 rows=$(( (n+9)/10 ))
  ffmpeg -v error -y -framerate $FPS -i "$tmp/f%03d.png" \
    -vf "tile=${cols}x${rows}:padding=0:color=0x00000000" -frames:v 1 \
    -c:v libwebp -quality 88 -pix_fmt yuva420p "$OUT/$name.webp"
  local fw fh
  fw=$(ffprobe -v error -show_entries stream=width -of csv=p=0 "$tmp/f001.png")
  fh=$(ffprobe -v error -show_entries stream=height -of csv=p=0 "$tmp/f001.png")
  echo "{\"frames\":$n,\"cols\":$cols,\"w\":$fw,\"h\":$fh,\"fps\":$FPS}" > "$OUT/$name.json"
  rm -rf "$tmp"; echo "$name: $n frames ${fw}x${fh}"
}
make walk     Video/video_cat_walk.mp4     0 6
make walk_sit Video/cat_walk_sit_meme.mp4  0 9.5
[ -f Video/cat_scratch.mp4 ] && make scratch Video/cat_scratch.mp4 0 3.8
[ -f Video/cat_turn.mp4 ]    && make turn    Video/cat_turn.mp4    0 4.2
[ -f Video/cat_standup.mp4 ] && make standup Video/cat_standup.mp4 0 6.5
[ -f Video/cat_sleep.mp4 ]   && make sleep   Video/cat_sleep.mp4   0 8
# Clip mới tạo bằng ComfyUI (video_gen/clips.json): build khi có Video/<id>.mp4 (đổi tên bản đẹp nhất thành <id>.mp4)
while read -r id sec; do
  f="Video/$id.mp4"; [ -f "$f" ] || f="Video/cat_$id.mp4"   # chấp nhận cả cat_<id>.mp4
  [ -f "$f" ] && make "$id" "$f" 0 "$sec"
done < <(node -e 'for (const c of require("./video_gen/clips.json").clips) console.log(c.id, c.sprite_sec || 4)')
true
