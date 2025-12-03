# Presentation Guide

## Overview
This presentation includes all the key components of the IMDb Recommendations App database project.

## File Location
`presentation.html` - Interactive HTML presentation

## How to Use

### Option 1: View in Browser
1. Open `presentation.html` in any modern web browser
2. Scroll through the slides
3. Use browser print function (Cmd+P / Ctrl+P) to save as PDF

### Option 2: Convert to PowerPoint
1. Open `presentation.html` in browser
2. Use browser extensions or online converters to convert HTML to PPTX
3. Or use tools like:
   - Pandoc: `pandoc presentation.html -o presentation.pptx`
   - Online converters: HTML to PPTX

### Option 3: Print to PDF
1. Open `presentation.html` in browser
2. Press Cmd+P (Mac) or Ctrl+P (Windows)
3. Select "Save as PDF"
4. Each slide will be on a separate page

## Presentation Contents

### Slide 1: Title Slide
- Project title and overview
- Key statistics (7 tables, 264 titles, 4,990 people, 27 genres)

### Slide 2: Dataset Introduction
- Overview of IMDb datasets
- Details on 4 dataset files:
  - title.basics.tsv (264 titles)
  - name.basics.tsv (4,990 people)
  - title.ratings.tsv (rating data)
  - title.principals.tsv (25 cast/crew entries)

### Slides 3-5: Table Introduction
- Complete table specifications for all 7 tables:
  1. app_user (4 demo users)
  2. title (264 titles)
  3. person (4,990 people)
  4. genre_lookup (27 genres)
  5. title_genre (167 relationships)
  6. title_person_role (25 entries)
  7. user_rating (23 ratings)

### Slide 6: ERD Diagram
- Entity-Relationship Diagram in ASCII format
- Shows all relationships between tables
- Key relationships explained

### Slide 7: Database Design Summary
- Design principles (3NF normalization)
- Constraints overview
- Additional components (views, stored procedures, indexes)

## Customization
The HTML file can be easily customized:
- Modify CSS styles in the `<style>` section
- Update content in each slide's HTML
- Add or remove slides by duplicating slide divs
- Change colors, fonts, or layout

## Notes
- Slides are designed for printing/PDF conversion
- Each slide is page-break separated for clean printing
- Responsive design works on different screen sizes
- All data is current as of project completion

