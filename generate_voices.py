#!/usr/bin/env python3
"""複用 earth_satellite 語音；--force 重新複製，--check 僅檢查現有檔案。"""

import argparse
import json
from pathlib import Path
import re
import shutil
import wave

ROOT = Path(__file__).resolve().parent
SOURCE = Path('/var/www/html/demo/htm/map/3D/earth_satellite/assets/voice/orbit-defense')
OUTPUT = ROOT / 'assets' / 'voice' / 'clean'
EVENTS = {'start', 'hurt', 'eject', 'playerExit', 'stolen', 'chase', 'baseHit', 'win', 'lose', 'wave', 'baseSupply'}


def clips():
    source = (ROOT / 'radio-lines.mjs').read_text(encoding='utf-8')
    bank = json.loads(source.split('=', 1)[1].strip().removesuffix(';'))
    supplies = [line for line in bank if line['event'] == 'baseSupply']
    if len(bank) - len(supplies) != 28 or not 2 <= len(supplies) <= 4:
        raise ValueError('語音包需保留 28 句敵軍語音，另加 2 至 4 句基地補給語音。')
    if len({line['id'] for line in bank}) != len(bank) or len({line['src'] for line in bank}) != len(bank):
        raise ValueError('語音編號與來源檔案不得重複。')
    if {line['event'] for line in bank} != EVENTS:
        raise ValueError('語音事件不完整。')
    for line in bank:
        if not re.fullmatch(r'\./assets/voice/clean/[A-Za-z]+_[0-9a-f]{40}\.wav', line['src']):
            raise ValueError('語音路徑有誤。')
        if not line['text'] or not line['speaker'] or not 0 < line['volume'] <= 1:
            raise ValueError('語音台詞、角色或音量有誤。')
        if line['event'] == 'baseSupply' and line.get('team') != 'player':
            raise ValueError('基地補給需使用友軍頻道。')
    return bank


def validate(path):
    if not path.is_file() or path.stat().st_size < 1000:
        raise ValueError(f'語音檔案不存在或太小：{path.name}')
    with wave.open(str(path), 'rb') as audio:
        duration = audio.getnframes() / audio.getframerate()
        if not 0.2 < duration <= 6 or audio.getnchannels() not in (1, 2):
            raise ValueError(f'無效的短篇 WAV：{path.name}')
        samples = audio.readframes(audio.getnframes())
        if not samples or not any(samples):
            raise ValueError(f'語音為空白：{path.name}')
    return {'seconds': round(duration, 3), 'bytes': path.stat().st_size}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=SOURCE, help='既有 WAV 來源目錄')
    parser.add_argument('--force', action='store_true', help='重新複製選用語音')
    parser.add_argument('--check', action='store_true', help='僅檢查現有語音，不讀取來源目錄')
    args = parser.parse_args()
    if not args.check:
        OUTPUT.mkdir(mode=0o755, parents=True, exist_ok=True)
        OUTPUT.chmod(0o755)
    for line in clips():
        target = ROOT / line['src']
        if not args.check and (args.force or not target.exists()):
            source = args.source / target.name
            validate(source)
            temporary = target.with_suffix('.tmp')
            try:
                shutil.copyfile(source, temporary)
                temporary.chmod(0o644)
                temporary.replace(target)
            finally:
                temporary.unlink(missing_ok=True)
        print(json.dumps({'file': target.name, **validate(target)}))
