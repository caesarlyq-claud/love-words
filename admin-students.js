(function(){
'use strict';
const form=document.getElementById('create-student-form');
form.addEventListener('submit',async function(event){
 event.preventDefault();const button=form.querySelector('button[type=submit]'),status=document.getElementById('create-student-status');
 if(button.disabled)return;
 const body={name:form.elements.studentName.value.trim(),cls:form.elements.studentClass.value.trim(),account:form.elements.studentAccount.value.trim(),password:form.elements.studentPassword.value};
 if(body.password!==form.elements.confirmPassword.value){status.textContent='两次输入的密码不一致。';return;}
 if(!/^[\p{L}\p{N}_-]{2,40}$/u.test(body.account)){status.textContent='账号请使用2–40位中文、字母、数字、下划线或短横线。';return;}
 if(body.password!==body.password.trim()){status.textContent='密码首尾请勿包含空格。';return;}
 const adminPassword=document.getElementById('password').value||sessionStorage.getItem('admin_pwd');
 if(!adminPassword){status.textContent='请先登录管理后台。';return;}
 button.disabled=true;status.textContent='正在创建账号，请稍候…';
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{
  const response=await fetch(API+'/admin/students',{method:'POST',headers:{'Content-Type':'application/json','X-Admin-Password':adminPassword},signal:controller.signal,body:JSON.stringify(body)});
  const result=await response.json();
  if(!response.ok)throw Error(response.status===401?'管理员登录已失效，请重新登录。':result.message||'创建失败（HTTP '+response.status+'），请稍后重试。');
  if(!result.student?.account)throw Error('服务未确认创建结果，请刷新名单核验后再操作。');
  form.reset();status.textContent='已创建：'+result.student.name+'（账号：'+result.student.account+'）。学生可用您刚设置的密码登录；如暂未生效，请约一分钟后重试。';
  const row={...result.student,learning:null};if(!data.some(s=>s.account===row.account))data.push(row);render();
 }catch(error){status.textContent=error.name==='AbortError'?'请求超时，创建结果尚未确认。请先刷新学生名单，核验此账号是否已存在。':error instanceof TypeError?'连接中断，创建结果尚未确认。请先刷新学生名单核验，再决定是否重试。':error.message;}
 finally{clearTimeout(timer);button.disabled=false;}
});
})();
