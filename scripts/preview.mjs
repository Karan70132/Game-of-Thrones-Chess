// Internal preview adapter; normal local usage is bash run.sh.
import {spawn} from 'node:child_process';
const args=process.argv.slice(2),get=(k,d)=>args.includes(k)?args[args.indexOf(k)+1]:d;
const child=spawn('.venv/bin/python',['manage.py','runserver',`${get('--host','127.0.0.1')}:${get('--port','4173')}`,'--settings=rookroom.preview_settings'],{stdio:'inherit'});
process.on('SIGTERM',()=>child.kill('SIGTERM'));child.on('exit',code=>process.exit(code??0));
