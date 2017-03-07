#! /usr/bin/env node

const pkg = require('../package.json');
const program = require('commander');
const fs = require('fs');
const Pagic = require('..').Pagic;
const chokidar = require('chokidar');

const Path = require('path');
program
  .version(pkg.version)
  .option('-s, --src-dir [path]', 'Set src dir')
  .option('-d, --dist-dir [path]', 'Set dist dir')
  .option('-w, --watch', 'Watch src dir change')
  .parse(process.argv);

const pagic = new Pagic({
  srcDir: program.srcDir,
  distDir: program.distDir,
});

pagic.build();

const detectFile = function(path){
   const ext = Path.extname(path);
   if(ext!=='.js'){
     return ext;
   }
   if(Path.basename(path,'.js')==='_layout'){
      return 'layout';
   }
   return ext;
};

if (program.watch) {
  var watcher = chokidar.watch(pagic.options.srcDir);

  //init scan ready for watchfile
  watcher.on('ready', () =>{
    watcher.on('add', (path, stats) =>{
      /*
        新增md文件: 文件路径=>生成
        ，其他文件 文件路径=>拷贝
        ，layout文件 文件路径=> 从当前目录开始，所有md文件，如果md文件（除了当前目录）的目录没有layout文件，都重新生成
      */
      console.log('add:', path);
      if(detectFile(path)==='.md'){
        pagic.addMd(path);
        return;
      }

      if(detectFile(path)==='layout'){
        pagic.buildMDByAdd(path);
        return;
      }

      pagic.copySingleFile(Path.relative(pagic.options.srcDir, path));
       
      
      //pagic.build();
      
      
    }).on('unlink', path =>{
      /*
        删除md文件: 文件路径=>删除html文件
        删除其他文件: 文件路径=> 删除对应文件
        删除layout文件: 文件路径=>当前目录开始，所有md文件，如果md文件目录没有layout，都重新生成
      */
      console.log('delete:',path);

      if(detectFile(path)==='.md'){
        pagic.delMd(Path.relative(pagic.options.srcDir, path));
        return;
      }

      if(detectFile(path)==='layout'){
        pagic.buildMDByDel(path);
        return;
      }

      pagic.deleteStaticFile(Path.relative(pagic.options.srcDir, path));
        
      
      //pagic.build();
    }).on('change', (path, stats) =>{
      /*
        修改md文件：文件路径=>重新生成
        修改其他文件：文件路径=>覆盖
        修改layout文件：文件路径=> 当前目录开始，所有md文件，如果所在目录(当前目录除外)没有layout文件，则重新生成
      */
      console.log('change:', path);

      if(detectFile(path)==='.md'){
        pagic.addMd(path);
        return;
      }

      if(detectFile(path)==='layout'){
        pagic.buildMDByAdd(path, true);
        return;
      }

      pagic.copySingleFile(Path.relative(pagic.options.srcDir, path));
      
      //pagic.build();
    }).on('error', error =>{
      console.log('watcher error: ${error}', error);
      watcher.close();
    });
  });
}
