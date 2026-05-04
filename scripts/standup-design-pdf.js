const fs = require('fs');
const { PDFDocument, rgb, StandardFonts } = require('/opt/data/home/hermes/node_modules/pdf-lib');

async function generateStandupPDF() {
  const standupData = JSON.parse(fs.readFileSync('/opt/data/home/hermes/data/standup.json', 'utf8'));
  
  const pdfDoc = await PDFDocument.create();
  
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  const pageWidth = 612;
  const pageHeight = 792;
  const outerPadding = 28; // Generous outer padding
  let yPosition = pageHeight - outerPadding;
  
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  
  // Colors matching the spec
  const colors = {
    pageBg: rgb(0.961, 0.965, 0.973),    // #F5F6F8
    white: rgb(1, 1, 1),                     // #FFFFFF
    accentBlue: rgb(0.118, 0.424, 1),        // #1E6FFF
    textDark: rgb(0.067, 0.067, 0.067),      // #111111
    borderLight: rgb(0.894, 0.902, 0.922),   // #E4E6EB
    taskBg: rgb(1, 1, 1),                    // White
    blueBadgeBg: rgb(0.902, 0.941, 1),       // #E6F0FF
    blueBadgeText: rgb(0.118, 0.424, 1),     // #1E6FFF
    greenBg: rgb(0.918, 0.969, 0.918),      // #EAF7EA
    greenBorder: rgb(0.224, 0.659, 0.271),   // #39A845
    greenText: rgb(0.18, 0.49, 0.196),      // #2E7D32
    shadow: rgb(0, 0, 0),                    // For shadow
  };
  
  // Draw page background
  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    color: colors.pageBg,
  });
  
  // Title
  page.drawText('BME Team Standup', {
    x: outerPadding,
    y: yPosition,
    size: 28,
    font: helveticaBold,
    color: colors.textDark,
  });
  yPosition -= 45;
  
  // Subtitle
  const dateStr = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });
  page.drawText(dateStr + ' • Taskboard View', {
    x: outerPadding,
    y: yPosition,
    size: 14,
    font: helvetica,
    color: rgb(0.525, 0.525, 0.536), // #86868b
  });
  yPosition -= 40;
  
  // Sort team members alphabetically
  const teamMembers = standupData.team_members || {};
  const sortedMembers = Object.entries(teamMembers).sort((a, b) => a[0].localeCompare(b[0]));
  
  const cardSpacing = 24; // Vertical spacing between person cards
  const cardPadding = 20;
  const accentStripeWidth = 7;
  const cardBorderRadius = 14;
  
  for (const [name, member] of sortedMembers) {
    const tasks = member.tasks || [];
    
    // Calculate card height
    const nameHeight = 28;
    const taskCardHeight = 60;
    const taskSpacing = 14;
    const statusBadgeHeight = 20;
    const totalTaskHeight = tasks.length > 0 
      ? tasks.reduce((acc, task) => {
          const status = task.status || 'in_progress';
          const hasStatus = status !== 'in_progress';
          return acc + taskCardHeight + (hasStatus ? statusBadgeHeight + 6 : 0) + taskSpacing;
        }, 0)
      : 30; // "No active tasks" height
    
    const cardHeight = nameHeight + totalTaskHeight + cardPadding * 2;
    
    // Check for page break
    if (yPosition < outerPadding + cardHeight + 50) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      yPosition = pageHeight - outerPadding;
      
      // Draw page background for new page
      page.drawRectangle({
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
        color: colors.pageBg,
      });
    }
    
    const cardX = outerPadding;
    const cardWidth = pageWidth - 2 * outerPadding;
    const cardY = yPosition - cardHeight;
    
    // Draw shadow (simulate with offset gray rectangle)
    page.drawRectangle({
      x: cardX + 2,
      y: cardY - 3,
      width: cardWidth,
      height: cardHeight,
      color: rgb(0, 0, 0),
      opacity: 0.06,
      borderRadius: cardBorderRadius,
    });
    
    // Draw person card background (white)
    page.drawRectangle({
      x: cardX,
      y: cardY,
      width: cardWidth,
      height: cardHeight,
      color: colors.white,
      borderColor: colors.borderLight,
      borderWidth: 1,
      borderRadius: cardBorderRadius,
    });
    
    // Draw accent stripe (left side, blue)
    page.drawRectangle({
      x: cardX,
      y: cardY,
      width: accentStripeWidth,
      height: cardHeight,
      color: colors.accentBlue,
      borderRadius: cardBorderRadius,
    });
    
    // Person name (large, bold, dark)
    const nameX = cardX + accentStripeWidth + cardPadding;
    const nameY = yPosition - cardPadding - 20;
    
    page.drawText(name, {
      x: nameX,
      y: nameY,
      size: 22,
      font: helveticaBold,
      color: colors.textDark,
    });
    
    // Tasks
    let taskY = nameY - 24;
    
    if (tasks.length > 0) {
      for (const task of tasks) {
        const status = task.status || 'in_progress';
        const desc = task.description || 'No description';
        
        const taskCardX = nameX;
        const taskCardWidth = cardWidth - accentStripeWidth - cardPadding - 10;
        
        // Task card styling based on status
        let taskBgColor = colors.taskBg;
        let taskBorderColor = colors.borderLight;
        let taskBorderWidth = 1;
        
        if (status === 'completed') {
          taskBgColor = colors.greenBg;
          taskBorderColor = colors.greenBorder;
          taskBorderWidth = 1.5;
        }
        
        // Draw task card
        page.drawRectangle({
          x: taskCardX,
          y: taskY - taskCardHeight + 16,
          width: taskCardWidth,
          height: taskCardHeight,
          color: taskBgColor,
          borderColor: taskBorderColor,
          borderWidth: taskBorderWidth,
          borderRadius: 11,
        });
        
        // Task description
        const descX = taskCardX + 16;
        const descY = taskY - 10;
        
        // Word wrap for description
        const words = desc.split(' ');
        let line = '';
        let descCurrentY = descY;
        const maxWidth = taskCardWidth - 32;
        
        for (const word of words) {
          const testLine = line + (line ? ' ' : '') + word;
          const width = helvetica.widthOfTextAtSize(testLine, 14);
          
          if (width > maxWidth && line) {
            page.drawText(line, { x: descX, y: descCurrentY, size: 14, font: helvetica, color: colors.textDark });
            descCurrentY -= 16;
            line = word;
          } else {
            line = testLine;
          }
        }
        
        if (line) {
          page.drawText(line, { x: descX, y: descCurrentY, size: 14, font: helvetica, color: colors.textDark });
        }
        
        // Status badge for IN PROGRESS
        if (status === 'in_progress') {
          const badgeText = 'IN PROGRESS';
          const badgeWidth = helvetica.widthOfTextAtSize(badgeText, 11) + 14;
          
          page.drawRectangle({
            x: descX,
            y: descCurrentY - 22,
            width: badgeWidth,
            height: 18,
            color: colors.blueBadgeBg,
            borderRadius: 9, // Pill shape
          });
          
          page.drawText(badgeText, {
            x: descX + 7,
            y: descCurrentY - 18,
            size: 11,
            font: helveticaBold,
            color: colors.blueBadgeText,
          });
        }
        
        // Status text for COMPLETED
        if (status === 'completed') {
          const statusText = 'COMPLETED';
          page.drawText(statusText, {
            x: descX,
            y: descCurrentY - 20,
            size: 12,
            font: helveticaBold,
            color: colors.greenText,
          });
        }
        
        // Potentially completed
        if (status === 'potentially_completed') {
          const statusText = 'POTENTIALLY COMPLETED';
          page.drawText(statusText, {
            x: descX,
            y: descCurrentY - 20,
            size: 11,
            font: helveticaBold,
            color: rgb(1, 0.624, 0.039), // Orange
          });
        }
        
        taskY -= taskCardHeight + taskSpacing + (status !== 'in_progress' ? 24 : 0);
      }
    } else {
      // No active tasks
      page.drawText('No active tasks', {
        x: nameX,
        y: taskY - 10,
        size: 13,
        font: helvetica,
        color: rgb(0.525, 0.525, 0.536), // #86868b
      });
    }
    
    yPosition -= cardHeight + cardSpacing;
  }
  
  // Footer
  page.drawText('Generated from Personal Insights Hub • ' + new Date().toISOString().split('T')[0], {
    x: outerPadding,
    y: outerPadding,
    size: 10,
    font: helvetica,
    color: rgb(0.525, 0.525, 0.536),
  });
  
  // Save PDF
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync('/tmp/standup_design.pdf', pdfBytes);
  
  console.log('✅ Design-matched PDF generated!');
  console.log('📄 File: /tmp/standup_design.pdf');
  console.log('📊 Size:', (pdfBytes.length / 1024).toFixed(2), 'KB');
  console.log('');
  console.log('Features:');
  console.log('  ✓ Light grey page background (#F5F6F8)');
  console.log('  ✓ White person cards with rounded corners');
  console.log('  ✓ Blue accent stripe (left side)');
  console.log('  ✓ Bold person names (22px)');
  console.log('  ✓ Task cards with status-based styling');
  console.log('  ✓ IN PROGRESS: Blue pill badges');
  console.log('  ✓ COMPLETED: Green background + text');
  console.log('  ✓ Soft drop shadows');
  console.log('  ✓ Alphabetical order');
}

generateStandupPDF().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
